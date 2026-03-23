import prompts from 'prompts';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stringify } from 'yaml';

export async function configWizard() {
  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'API name',
      hint: 'e.g. stripe, github',
      validate: (v: string) => v.length > 0 || 'Required',
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description',
    },
    {
      type: 'text',
      name: 'spec',
      message: 'OpenAPI spec URL or file path',
      validate: (v: string) => v.length > 0 || 'Required',
    },
    {
      type: 'text',
      name: 'url',
      message: 'Base URL',
      hint: 'e.g. https://api.stripe.com',
    },
    {
      type: 'confirm',
      name: 'hasAuth',
      message: 'Requires authentication?',
      initial: true,
    },
    {
      type: (prev: boolean) => prev ? 'text' : null,
      name: 'envVar',
      message: 'Environment variable for token',
      initial: (_: any, values: any) => `${(values.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`,
    },
    {
      type: (_: any, values: any) => values.hasAuth ? 'select' : null,
      name: 'authType',
      message: 'Auth type',
      choices: [
        { title: 'Bearer token', value: 'bearer' },
        { title: 'API key header', value: 'api-key' },
        { title: 'Basic auth', value: 'basic' },
      ],
      initial: 0,
    },
  ], { onCancel: () => { console.log('Aborted.'); process.exit(0); } });

  const config: Record<string, any> = {
    name: response.name.charAt(0).toUpperCase() + response.name.slice(1),
    type: 'api',
    spec: response.spec,
  };

  if (response.description) config.description = response.description;
  if (response.url) config.url = response.url;
  if (response.envVar) {
    config.auth = { env: response.envVar };
    if (response.authType && response.authType !== 'bearer') {
      config.auth.type = response.authType;
    }
  }

  const yaml = stringify(config);
  const filename = `${response.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.yaml`;

  console.log(`\n\x1b[2m${yaml}\x1b[0m`);

  const { write } = await prompts({
    type: 'confirm',
    name: 'write',
    message: `Write to ${filename}?`,
    initial: true,
  });

  if (!write) { console.log('Aborted.'); return; }

  const filepath = resolve(process.cwd(), filename);
  writeFileSync(filepath, yaml);
  console.log(`\nSaved ${filepath}`);
  console.log(`Run \x1b[1mgodmode add ${response.name.toLowerCase()}\x1b[0m to register it.`);
}
