// One entity per file: MikroORM's folder-based discovery imports each compiled
// *.entity.js as an ES module, and Node only sees the named exports of a CommonJS
// file that exports a single class. A file exporting several entities hides them
// all, so they are re-exported from here instead.
export { Post } from './entities/post.entity'
export { PostVersion } from './entities/post-version.entity'
export type { Content } from './entities/post-version.entity'
