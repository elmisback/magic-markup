# Codetations

Codetations is an application of Magic Markup to the problem of tool attachment.

TODO further description

## Development

Codetations has three parts that have to be run in parallel:

1. The frontend, which is a React application.
2. The Node.js document server, which handles interaction with the disk where application state and documents are stored.
3. The Node.js retagging server, which handles retagging requests.

## Quick start in VSCode

1. Clone the repository with `git clone git@github.com:elmisback/magic-markup`
2. Change directory to `codetations-react` and run `npm i` to install dependencies
3. (Not needed now, but you may need to do this if you modify the server parts.) Switch to the `server` directory and run `tsc` to compile the servers (make sure you have TypeScript installed first, recommend installing via [`nvm`](https://github.com/nvm-sh/nvm)). It will compile with errors, but that's fine.
4. In the codetations-react directory, create a `.env` file with the following content:
```
OPENAI_API_KEY=your_openai_api_key
```
5. In VSCode, go to `Run and Debug` and select `Launch Codetations`. This runs a script (in `.vscode/launch.json`) that starts the frontend, document server, and retagging server on ports 3000, 3002, and 3004 respectively. They can also be started individually; see `package.json` scripts for the commands.





## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
