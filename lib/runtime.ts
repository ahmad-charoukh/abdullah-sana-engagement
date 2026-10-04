export function configValue(
  key: 'ADMIN_PASSWORD' | 'ADMIN_USERNAME' | 'APP_URL'
) {
  return process.env[key];
}
