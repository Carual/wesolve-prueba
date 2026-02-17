import express, { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'
import morgan from 'morgan'
import jwt from 'jsonwebtoken'
import path from 'path'

const app = express()
app.use(cors())
app.use(morgan('dev'))
app.use(express.json())

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const JWT_SECRET = process.env.JWT_SECRET!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
	throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or JWT_SECRET')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
})

function isUuid(v: unknown): v is string {
	return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

// --- Auth (Bearer JWT) ---
type JwtPayload = { sub: string; typ: 'access' }

function requireAuth(req: Request, res: Response, next: NextFunction) {
	const header = req.header('authorization') || ''
	const m = header.match(/^Bearer\s+(.+)$/i)
	if (!m) return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' })

	const token = m[1]
	try {
		const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
		if (!payload?.sub || !isUuid(payload.sub)) return res.status(401).json({ error: 'Invalid token payload' })
		;(req as any).userId = payload.sub
		next()
	} catch {
		return res.status(401).json({ error: 'Invalid or expired token' })
	}
}

function getUserId(req: Request) {
	return (req as any).userId as string
}

// ========== Routes ==========

app.get('/health', (_req, res) => res.json({ ok: true }))

/**
 * Login:
 * POST /login
 * body: { userId: uuid }
 * returns: { token, user }
 */
app.post('/login', async (req, res) => {
	const userId = req.body?.userId
	if (!isUuid(userId)) return res.status(400).json({ error: 'userId must be a uuid' })

	const { data: user, error } = await supabase.from('users').select('id, display_name, created_at').eq('id', userId).maybeSingle()

	if (error) return res.status(500).json({ error: error.message })
	if (!user) return res.status(404).json({ error: 'User not found' })

	const token = jwt.sign({ sub: userId, typ: 'access' }, JWT_SECRET, { expiresIn: '30d' })

	res.json({ token, user })
})

/**
 * Optional: whoami
 * GET /me (requires bearer)
 */
app.get('/me', requireAuth, async (req, res) => {
	const userId = getUserId(req)

	const { data: user, error } = await supabase.from('users').select('id, display_name, created_at').eq('id', userId).maybeSingle()

	if (error) return res.status(500).json({ error: error.message })
	if (!user) return res.status(404).json({ error: 'User not found' })

	res.json({ user })
})

/**
 * GET /users - list registered users
 */
app.get('/users', async (_req, res) => {
	const { data, error } = await supabase.from('users').select('id, display_name, created_at').order('created_at', { ascending: false }).limit(500)

	if (error) return res.status(500).json({ error: error.message })
	res.json({ items: data ?? [] })
})

/**
 * GET /problems - browse with filters
 * /problems?search=&category=&location=&country_code=
 */
app.get('/problems', async (req, res) => {
	const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
	const category = typeof req.query.category === 'string' ? req.query.category.trim() : ''
	const location = typeof req.query.location === 'string' ? req.query.location.trim() : ''
	const country = typeof req.query.country_code === 'string' ? req.query.country_code.trim().toUpperCase() : ''

	let q = supabase
		.from('problems')
		.select('id,title,description,category,location,country_code,created_at, problem_matches(count)')
		.order('created_at', { ascending: false })
		.limit(200)

	if (category) q = q.eq('category', category)
	if (country) q = q.eq('country_code', country)
	if (location) q = q.ilike('location', `%${location}%`)
	if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

	const { data, error } = await q
	if (error) return res.status(500).json({ error: error.message })

	const items = (data ?? []).map((p: any) => ({
		id: p.id,
		title: p.title,
		description: p.description,
		category: p.category,
		location: p.location,
		country_code: p.country_code,
		created_at: p.created_at,
		collaboratorCount: Number(p.problem_matches?.[0]?.count ?? 0),
	}))

	res.json({ items })
})

/**
 * POST /problems/:id/match (requires bearer)
 * body: { role: SOLVER|AFFECTED }
 */
app.post('/problems/:id/match', requireAuth, async (req, res) => {
	const problemId = req.params.id
	const userId = getUserId(req)

	if (!isUuid(problemId)) return res.status(400).json({ error: 'problem id must be a uuid' })

	const role = req.body?.role
	if (role !== 'SOLVER' && role !== 'AFFECTED') {
		return res.status(400).json({ error: 'role must be SOLVER or AFFECTED' })
	}

	const { data: problem, error: pErr } = await supabase.from('problems').select('id').eq('id', problemId).maybeSingle()

	if (pErr) return res.status(500).json({ error: pErr.message })
	if (!problem) return res.status(404).json({ error: 'Problem not found' })

	const { data, error } = await supabase
		.from('problem_matches')
		.upsert({ user_id: userId, problem_id: problemId, role }, { onConflict: 'user_id,problem_id' })
		.select('id,user_id,problem_id,role,created_at')
		.single()

	if (error) return res.status(500).json({ error: error.message })
	res.json({ ok: true, match: data })
})

/**
 * DELETE /problems/:id/match (requires bearer)
 */
app.delete('/problems/:id/match', requireAuth, async (req, res) => {
	const problemId = req.params.id
	const userId = getUserId(req)

	if (!isUuid(problemId)) return res.status(400).json({ error: 'problem id must be a uuid' })

	const { error } = await supabase.from('problem_matches').delete().eq('user_id', userId).eq('problem_id', problemId)

	if (error) return res.status(500).json({ error: error.message })
	res.json({ ok: true })
})

/**
 * GET /problems/:id/users - collaborators (public)
 * Optional: ?role=SOLVER|AFFECTED
 */
app.get('/problems/:id/users', async (req, res) => {
	const problemId = req.params.id
	if (!isUuid(problemId)) return res.status(400).json({ error: 'problem id must be a uuid' })

	const role = typeof req.query.role === 'string' ? req.query.role.trim().toUpperCase() : ''
	const roleFilter = role === 'SOLVER' || role === 'AFFECTED' ? role : null

	let q = supabase
		.from('problem_matches')
		.select('role, created_at, users (id, display_name)')
		.eq('problem_id', problemId)
		.order('created_at', { ascending: false })
		.limit(500)

	if (roleFilter) q = q.eq('role', roleFilter)

	const { data, error } = await q
	if (error) return res.status(500).json({ error: error.message })

	const items = (data ?? []).map((r: any) => ({
		user: { id: r.users?.id ?? null, display_name: r.users?.display_name ?? null },
		role: r.role,
		matched_at: r.created_at,
	}))

	res.json({ problemId, items })
})
/**
 * GET /me/matches (requires bearer)
 * Returns the authenticated user's matched problems including role + matched_at.
 */
app.get('/me/matches', requireAuth, async (req, res) => {
	const userId = getUserId(req)

	const limit = Math.min(Number(req.query.limit ?? 200), 500)

	// Requires FK: problem_matches.problem_id -> problems.id
	const { data, error } = await supabase
		.from('problem_matches')
		.select(
			`
      role,
      created_at,
      problems (
        id,
        title,
        description,
        category,
        location,
        country_code,
        created_at
      )
    `,
		)
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(limit)

	if (error) return res.status(500).json({ error: error.message })

	const items = (data ?? [])
		.filter((r: any) => r.problems)
		.map((r: any) => ({
			role: r.role,
			matched_at: r.created_at,
			problem: {
				id: r.problems.id,
				title: r.problems.title,
				description: r.problems.description,
				category: r.problems.category,
				location: r.problems.location,
				country_code: r.problems.country_code,
				created_at: r.problems.created_at,
			},
		}))

	res.json({ items })
})

// Serve /public/*
app.use(express.static(path.join(process.cwd(), 'public')))

// Serve the UI at /
app.get('/', (_req, res) => {
	res.sendFile(path.join(process.cwd(), 'public', 'index.html'))
})

// Fallback error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
	console.error(err)
	res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
