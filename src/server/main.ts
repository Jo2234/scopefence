import {serve} from '@hono/node-server';
import {createApp} from './app.js';
import {loadConfig} from './config.js';
const config=loadConfig();
serve({fetch:createApp({config}).fetch,hostname:config.host,port:config.port},()=>console.log(`ScopeFence listening at http://${config.host}:${config.port} (${config.mode})`));
