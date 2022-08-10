const client = {
  tweets: {
    getRules: jest.fn(() => Promise.resolve({ data: [] })),
    addOrDeleteRules: jest.fn(() =>
      Promise.resolve({
        data: [
          {
            id: "999",
          },
        ],
      })
    ),
  },
};

class Client {
  constructor() {
    return client;
  }
}

export { Client };
