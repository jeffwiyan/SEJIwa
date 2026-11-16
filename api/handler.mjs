import apiHandler from './[...route].mjs';

const INTERNAL_ROUTE_PARAM = '__api_path';
const validApiPath = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

export default function handler(request, response) {
  let url;
  try {
    url = new URL(request.url, 'http://vercel.internal');
  } catch {
    response.statusCode = 400;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.end(JSON.stringify({ error: 'Path API tidak valid.' }));
  }

  const apiPath = url.searchParams.get(INTERNAL_ROUTE_PARAM);
  if (!apiPath || !validApiPath.test(apiPath)) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.end(JSON.stringify({ error: 'Endpoint API tidak ditemukan.' }));
  }

  url.searchParams.delete(INTERNAL_ROUTE_PARAM);
  request.url = `/api/${apiPath}${url.search}`;
  return apiHandler(request, response);
}
