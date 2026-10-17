import path from 'node:path';
export type ServerConfig = {
  mode:'live'|'fixture'; llm_url:string; fixture_dir:string; static_dir:string;
  production:boolean; host:'127.0.0.1'; port:number; timeout_ms:number;
};
export function loadConfig(env:NodeJS.ProcessEnv = process.env):ServerConfig {
  const mode = env.SCOPEFENCE_MODE ?? 'live';
  if (mode !== 'live' && mode !== 'fixture') throw Error('SCOPEFENCE_MODE must be live or fixture');
  const portText = env.SCOPEFENCE_PORT ?? '5178';
  if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) {
    throw Error('SCOPEFENCE_PORT must be an integer from 1 to 65535');
  }
  return {
    mode, llm_url:env.SCOPEFENCE_LLM_URL ?? 'http://127.0.0.1:8089',
    fixture_dir:path.resolve(env.SCOPEFENCE_FIXTURE_DIR ?? 'fixtures/model-outputs'),
    static_dir:path.resolve('dist/web'), production:env.NODE_ENV === 'production',
    host:'127.0.0.1', port:Number(portText), timeout_ms:240000,
  };
}
