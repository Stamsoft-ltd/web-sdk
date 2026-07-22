type DiagnosticLevel = 'info' | 'warn' | 'error';

const prefix = '[theme-park]';

export const logDiagnostic = (level: DiagnosticLevel, code: string, payload?: Record<string, unknown>) => {
	const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
	logger(`${prefix} ${code}`, payload ?? {});
};
