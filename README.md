# dump-lush-db
Package for dumping the Lush datasbase.

### With every significant update of the database, a new release of the docker image should be issued.
To create a new release, run
```
npm run release
```
To create a new release of the preview of the database, run
```
npm run release:preview
```
To dump the database in a specific folder, run
```
npm start
```
Or in command line inside the project’s root run
```
npx tsc && node build/index.js
```
