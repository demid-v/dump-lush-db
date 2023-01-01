# dump-lush-db
Package for dumping the Lush datasbase.

With every significant update of the database, a new release of the docker image should be issued.<br/>

### Create a new release
```sh
npm run release
```

### Create a new release of the preview of the database
```sh
npm run release:preview
```

### Dump the database in a specific folder
```sh
npm start
```

### Dump the database in command line inside the project’s root
```sh
npx tsc && node build/index.js
```
