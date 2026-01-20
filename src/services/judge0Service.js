import fetch from "node-fetch";

const JUDGE0_URL = process.env.JUDGE0_URL || "https://ce.judge0.com";

export async function runCodeOnJudge0(source_code, language_id) {
  const body = {
    source_code,
    language_id,
  };

  const url = `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`;
  const headers = {
    "Content-Type": "application/json",
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Judge0 submission failed with status ${resp.status}`);
  }

  const result = await resp.json();
  return result; 
}
