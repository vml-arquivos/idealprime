export const COOKIE_NAME = "app_session_id";
// Cookie de sessão do CLIENTE (área do cliente / minha conta) — sempre
// separado do COOKIE_NAME acima, que é exclusivo da equipe interna
// (admin/vendedor). Nomes diferentes evitam qualquer colisão entre as duas
// sessões no mesmo navegador (ex.: um admin testando como cliente no mesmo
// browser).
export const CUSTOMER_COOKIE_NAME = "customer_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
