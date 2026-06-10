/**
 * uploadToGitHub — Base44 backend function
 *
 * Saves chapter content as .md files to a GitHub repo.
 * Returns the raw.githubusercontent.com URL for the file.
 *
 * Required secret: GITHUB_PAT
 */

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = 'cliffypoodev';
const REPO_NAME = 'unitybookstudio';
const BRANCH = 'main';

function json(data: Record<string, unknown>, init?: ResponseInit) {
  return Response.json(data, init);
}

function safeFileName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function getExistingSha(filePath: string, headers: HeadersInit) {
  const checkResp = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}&_t=${Date.now()}`,
    { headers }
  );

  if (checkResp.ok) {
    const existing = await checkResp.json();
    return existing?.sha || null;
  }

  if (checkResp.status === 404) return null;

  const text = await checkResp.text();
  throw new Error(`GitHub SHA lookup failed: ${checkResp.status} ${text}`);
}

function encodeContent(content: string, isBinary?: boolean) {
  if (isBinary) return content;

  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

async function putFile({
  filePath,
  safeName,
  base64Content,
  existingSha,
  headers,
}: {
  filePath: string;
  safeName: string;
  base64Content: string;
  existingSha: string | null;
  headers: HeadersInit;
}) {
  const putBody: Record<string, unknown> = {
    message: `UBS: save ${safeName}`,
    content: base64Content,
    branch: BRANCH,
  };

  if (existingSha) {
    putBody.sha = existingSha;
  }

  return fetch(`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
    signal: AbortSignal.timeout(30000),
  });
}

Deno.serve(async (req) => {
  try {
    const { content, projectId, chapterId, filename, isBinary } = await req.json();

    if (!content) {
      return json({ error: 'content is required' }, { status: 400 });
    }

    const token = Deno.env.get('GITHUB_PAT');

    if (!token) {
      return json({ error: 'GITHUB_PAT secret not configured' }, { status: 500 });
    }

    const rawName = filename || `chapter-${chapterId || Date.now()}`;
    const safeName = safeFileName(rawName);
    const extension = isBinary ? '' : '.md';
    const hasExtension = /\.\w{2,4}$/.test(safeName);
    const filePath = `chapters/${projectId || 'default'}/${safeName}${hasExtension ? '' : extension}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'UnityBookStudio/1.0',
    };

    const base64Content = encodeContent(content, isBinary);

    let existingSha = await getExistingSha(filePath, headers);
    let putResp = await putFile({
      filePath,
      safeName,
      base64Content,
      existingSha,
      headers,
    });

    if (putResp.status === 409) {
      console.warn(`[uploadToGitHub] 409 conflict for ${filePath}; refreshing SHA and retrying.`);

      await new Promise((resolve) => setTimeout(resolve, 400));

      existingSha = await getExistingSha(filePath, headers);
      putResp = await putFile({
        filePath,
        safeName,
        base64Content,
        existingSha,
        headers,
      });
    }

    if (!putResp.ok) {
      const errText = await putResp.text();

      return json(
        {
          error: `GitHub API error: ${putResp.status} ${errText}`,
          path: filePath,
        },
        { status: putResp.status }
      );
    }

    const result = await putResp.json();
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${filePath}`;

    return json({
      file_url: rawUrl,
      sha: result.content?.sha || null,
      path: filePath,
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return json({ error: 'GitHub upload timed out after 30s' }, { status: 504 });
    }

    return json({ error: error.message || String(error) }, { status: 500 });
  }
});