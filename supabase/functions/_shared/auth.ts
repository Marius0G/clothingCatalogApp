/**
 * Guard for cron/service-only functions. The platform gateway (verify_jwt)
 * has already validated the token signature by the time we run, so checking
 * the role claim is safe — a forged unsigned token never reaches us.
 */
export function isServiceRole(req: Request): boolean {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  try {
    const payloadPart = token.split('.')[1];
    const payload = JSON.parse(
      atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')),
    );
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}
