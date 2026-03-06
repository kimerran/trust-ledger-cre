import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const CHAINLINK_DIR = path.join(PROJECT_ROOT, 'chainlink');
const WORKFLOW_DIR = './workflows/trustledger-risk-monitor';

export async function POST(req: NextRequest) {
  const { decisionId, inputHash, signature, modelId, callbackUrl, decision, secrets } =
    await req.json();

  if (!decisionId || !inputHash || !signature) {
    return NextResponse.json(
      { error: 'Missing decisionId, inputHash, or signature' },
      { status: 400 },
    );
  }

  const httpPayload = JSON.stringify({
    decisionId,
    signature,
    modelId,
    inputHash,
    callbackUrl,
    decision,
    secrets,
  });

  // Resolve cre binary — prefer ~/.cre/bin/cre, fall back to PATH
  const homeCre = path.join(process.env.HOME ?? '', '.cre', 'bin', 'cre');

  try {
    const { stdout, stderr } = await execFileAsync(
      homeCre,
      [
        'workflow',
        'simulate',
        WORKFLOW_DIR,
        '-R',
        '.',
        '--target',
        'dev-settings',
        '--trigger-index',
        '0',
        '--non-interactive',
        '--http-payload',
        httpPayload,
      ],
      {
        cwd: CHAINLINK_DIR,
        timeout: 120_000,
        env: {
          ...process.env,
          PATH: `${path.join(process.env.HOME ?? '', '.cre', 'bin')}:${path.join(process.env.HOME ?? '', '.bun', 'bin')}:${process.env.PATH}`,
        },
      },
    );

    return NextResponse.json({
      success: true,
      data: {
        stdout,
        stderr,
      },
    });
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message ?? 'CRE simulation failed',
          stdout: error.stdout ?? '',
          stderr: error.stderr ?? '',
        },
      },
      { status: 500 },
    );
  }
}
