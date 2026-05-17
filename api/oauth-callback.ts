import { handler } from '../netlify/functions/oauth-callback.js';
import wrap from './_wrapper.js';
export default wrap(handler);
