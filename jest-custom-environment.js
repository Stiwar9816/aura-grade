const NodeEnvironment = require('jest-environment-node').TestEnvironment;

class CustomEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    
    // Mock localStorage to prevent SecurityError
    this.global.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    };
  }
}

module.exports = CustomEnvironment;
