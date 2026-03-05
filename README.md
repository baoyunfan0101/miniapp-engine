## Mini App Engine

src/
  app.js              // app logic entry
  main.js             // main thread entry
  worker.js           // worker thread entry

  shared/
    protocol.js       // message types & error codes

  compiler/
    index.js          // compiler entry
    parse.js          // DSL -> AST
    transform.js      // AST -> IR
    expression.js     // {{ }} evaluator

  runtime/
    evaluate.js       // IR + data -> vDOM

  renderer/
    index.js          // renderer entry
    dom.js            // DOM helpers
    mount.js          // initial mount
    patch.js          // diff update