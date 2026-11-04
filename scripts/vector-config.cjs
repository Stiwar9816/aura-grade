function vectorSslOptions(env) {
  const mode = env.DB_SSL_MODE ?? (env.STATE === 'prod' ? 'require' : 'disable');
  return mode === 'require' ? { rejectUnauthorized: false } : false;
}
module.exports = { vectorSslOptions };
