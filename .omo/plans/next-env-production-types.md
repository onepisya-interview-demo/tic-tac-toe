# Brief: 同步 Next 生成类型引用

Next 在 production build 后将 `next-env.d.ts` 的类型引用从 dev 路径切换到
production 路径。该生成文件按仓库约定单独提交，避免混入功能提交。
