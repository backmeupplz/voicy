module.exports = {
  "extends": "airbnb",
  "plugins": [
      "react",
      "jsx-a11y",
      "import",
      "promise",
  ],
  "rules": {
    "require-jsdoc": 2,
    "promise/catch-or-return": 2,
    "no-underscore-dangle": [2, { "allow": ["_id", "_text"] }], /** Mongoose uses _id, we can't have control over it */
    "no-use-before-define": 0,
    "no-console": ["error", { allow: ["info"] }],
    "global-require": 0,
    "no-param-reassign": 0,
  }
};