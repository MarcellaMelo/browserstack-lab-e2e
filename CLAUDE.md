# Project rules

- All code, test names, variable names and comments must be in English.
- Use `getByTestId` for locators whenever a `data-testid` exists.
- Each test must be independent: create its own data and use unique emails with a timestamp.
- Add short comments explaining the intent of each test step.
- The app under test runs at http://localhost:3000 (API at http://localhost:3001)
  and comes from https://github.com/juliodelimas/browserstack-lab.
- Run tests with: `npx playwright test`
