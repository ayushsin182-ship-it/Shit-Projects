'use strict';
const crypto = require('node:crypto');
const LANGUAGES = {cpp: 'main.cpp', python: 'main.py', java: 'Main.java'};
function identify(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw Error('Use an HTTPS problem URL.');
  let m;
  if (u.hostname === 'codeforces.com') {
    m = u.pathname.match(/^\/(contest|gym)\/(\d+)\/problem\/([A-Za-z0-9]+)\/?$/);
    if (m) return {site:'codeforces', key:`${m[1]}-${m[2]}-${m[3]}`, url:`https://codeforces.com/${m[1]}/${m[2]}/problem/${m[3]}`, contest:m[2], index:m[3], group:m[1]};
    m = u.pathname.match(/^\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)\/?$/);
    if (m) return {site:'codeforces', key:`problemset-${m[1]}-${m[2]}`, url:`https://codeforces.com/problemset/problem/${m[1]}/${m[2]}`, contest:m[1], index:m[2], group:'problemset'};
  }
  if (u.hostname === 'atcoder.jp' && (m=u.pathname.match(/^\/contests\/([\w-]+)\/tasks\/([\w-]+)\/?$/)))
    return {site:'atcoder',key:`${m[1]}-${m[2]}`,url:`https://atcoder.jp/contests/${m[1]}/tasks/${m[2]}`,contest:m[1],task:m[2]};
  if (u.hostname === 'leetcode.com' && (m=u.pathname.match(/^\/problems\/([\w-]+)(?:\/(?:description|submissions|solutions|editorial)(?:\/.*)?)?\/?$/)))
    return {site:'leetcode',key:m[1],url:`https://leetcode.com/problems/${m[1]}/`,slug:m[1]};
  throw Error('Open a Codeforces, AtCoder or LeetCode problem page.');
}
function string(v, max, name) {
  if (typeof v !== 'string' || v.length > max) throw Error(`Invalid ${name}.`);
  return v;
}
function normalizeProblem(data) {
  if (!data || typeof data !== 'object') throw Error('Missing problem.');
  const id = identify(string(data.url, 2000, 'URL'));
  if (!Object.hasOwn(LANGUAGES, data.language)) throw Error('Choose C++, Python or Java.');
  const samples = data.samples ?? [];
  if (!Array.isArray(samples) || samples.length > 60) throw Error('At most 60 samples are supported.');
  const p = {...id, language:data.language, title:string(data.title || id.key, 500, 'title'),
    statement:string(data.statement || '',200000,'statement'),
    samples:samples.map(s=>({input:string(s.input,100000,'sample input'),output:string(s.output,100000,'sample output')})),
    snippet:string(data.snippet || '',100000,'snippet'), version:1};
  if (id.site === 'leetcode') {
    if (!/^\d+$/.test(String(data.questionId))) throw Error('LeetCode question ID unavailable; refresh and import again.');
    p.questionId=String(data.questionId);
    p.testInput=string(data.testInput || '',100000,'LeetCode test input');
  }
  return p;
}
function fingerprint(p, code) {
  return crypto.createHash('sha256').update(JSON.stringify({url:p.url,language:p.language,samples:p.samples,testInput:p.testInput,code})).digest('hex');
}
function sourceHash(code) { return crypto.createHash('sha256').update(code).digest('hex'); }
function equalOutput(a,b) { return a.trim().split(/\s+/).filter(Boolean).join('\n') === b.trim().split(/\s+/).filter(Boolean).join('\n'); }
function template(language,site) {
  if (site === 'leetcode') throw Error('LeetCode starter snippet is missing. Refresh the problem page and re-import.');
  return {
    cpp:'#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // TODO: write your solution\n    return 0;\n}\n',
    python:'import sys\n\ndef solve():\n    # TODO: write your solution\n    pass\n\nif __name__ == "__main__":\n    solve()\n',
    java:'import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        // TODO: write your solution\n    }\n}\n'
  }[language];
}
module.exports={LANGUAGES,identify,normalizeProblem,fingerprint,sourceHash,equalOutput,template};
