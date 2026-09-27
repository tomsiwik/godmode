import type { InterfaceKey, MultiManifest } from './spec.js';

export function generateSkill(multi: MultiManifest): string {
  const lines = [
    `# ${multi.slug}`,
    '',
    multi.description || `${multi.name} godmode extension.`,
    '',
    '## Invocation',
    '',
  ];
  for (const [iface, data] of Object.entries(multi.interfaces) as Array<[InterfaceKey, any]>) {
    if (!data) continue;
    const route = data.routes?.[0];
    const example = route
      ? `godmode ${multi.slug} ${iface}${iface === 'api' ? ` ${route.method.toUpperCase()}` : ''} ${route.segments.map((s: any) => s.value).join(' ')}`
      : `godmode ${multi.slug} ${iface} --help`;
    lines.push(`- ${iface}: \`${example}\``);
  }
  if (multi.auth?.env) {
    lines.push('', '## Authentication', '', `Set \`${multi.auth.env}\`.`);
  }
  return `${lines.join('\n')}\n`;
}
