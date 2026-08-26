// ============================================================
// KI MES 관리자 전용 계정관리 Edge Function
//   배포:  supabase functions deploy ki-admin-user
//   또는 Supabase 대시보드 > Edge Functions > New function
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const SRV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!token) return json({ error: '인증 토큰이 없습니다.' }, 401)

    const asUser = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: me } = await asUser.auth.getUser()
    if (!me?.user) return json({ error: '유효하지 않은 세션입니다.' }, 401)

    const admin = createClient(URL, SRV)
    const { data: emp } = await admin.from('ki_employee')
      .select('emp_no,emp_name,role,is_active').eq('auth_uid', me.user.id).maybeSingle()
    if (!emp || emp.role !== '관리자' || emp.is_active === false)
      return json({ error: '관리자 권한이 필요합니다.' }, 403)

    const body = await req.json()
    const action: string = body.action
    const empNo: string = body.emp_no
    const email: string = (body.email || '').trim().toLowerCase()
    const password: string = body.password || ''

    if (action === 'create') {
      if (!empNo || !email || password.length < 6)
        return json({ error: '사번 · 이메일 · 6자 이상 비밀번호가 필요합니다.' }, 400)
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { emp_no: empNo }
      })
      if (error) return json({ error: error.message }, 400)
      const { error: e2 } = await admin.from('ki_employee')
        .update({ auth_uid: data.user.id, login_email: email }).eq('emp_no', empNo)
      if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: e2.message }, 400) }
      return json({ ok: true, uid: data.user.id, message: `${empNo} 계정이 생성되었습니다.` })
    }

    if (action === 'password') {
      if (password.length < 6) return json({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400)
      const { data: t } = await admin.from('ki_employee').select('auth_uid').eq('emp_no', empNo).maybeSingle()
      if (!t?.auth_uid) return json({ error: '연결된 계정이 없습니다. 먼저 계정을 생성하세요.' }, 400)
      const { error } = await admin.auth.admin.updateUserById(t.auth_uid, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, message: `${empNo} 비밀번호가 재설정되었습니다.` })
    }

    if (action === 'disable' || action === 'enable') {
      const on = action === 'enable'
      const { data: t } = await admin.from('ki_employee').select('auth_uid').eq('emp_no', empNo).maybeSingle()
      if (t?.auth_uid)
        await admin.auth.admin.updateUserById(t.auth_uid, { ban_duration: on ? 'none' : '87600h' })
      await admin.from('ki_employee').update({ is_active: on }).eq('emp_no', empNo)
      return json({ ok: true, message: `${empNo} 계정을 ${on ? '사용' : '중지'} 처리했습니다.` })
    }

    if (action === 'delete') {
      if (empNo === emp.emp_no) return json({ error: '본인 계정은 삭제할 수 없습니다.' }, 400)
      const { data: t } = await admin.from('ki_employee').select('auth_uid').eq('emp_no', empNo).maybeSingle()
      if (t?.auth_uid) await admin.auth.admin.deleteUser(t.auth_uid)
      await admin.from('ki_permission').delete().eq('emp_no', empNo)
      await admin.from('ki_employee').delete().eq('emp_no', empNo)
      return json({ ok: true, message: `${empNo} 사용자와 계정이 삭제되었습니다.` })
    }

    return json({ error: '알 수 없는 요청입니다: ' + action }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
