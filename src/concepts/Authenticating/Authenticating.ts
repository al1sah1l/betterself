import {
  pbkdf2Sync,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  type Db,
  MongoServerError,
} from "mongodb";

export class InvalidUsername extends Error {}
export class WeakPassword extends Error {}
export class UsernameTaken extends Error {}
export class InvalidCredentials extends Error {}

type AccountDocument = {
  _id: string;
  salt: string;
  verifier: string;
};

const USERNAME = /^[A-Za-z0-9_-]{3,32}$/;

function makeVerifier(
  password: string,
  salt: string,
): Buffer {
  return pbkdf2Sync(
    password,
    salt,
    10_000,
    32,
    "sha256",
  );
}

export class AuthenticatingConcept {
  private readonly accounts;

  constructor(
    db: Db,
    private readonly freshSalt: () => string = randomUUID,
  ) {
    this.accounts =
      db.collection<AccountDocument>("auth_accounts");
  }

  async register({
    username,
    password,
  }: {
    username: string;
    password: string;
  }) {
    if (!USERNAME.test(username)) {
      throw new InvalidUsername(
        "A username must contain 3 to 32 letters, numbers, underscores, or hyphens.",
      );
    }

    if (password.length < 8 || password.length > 128) {
      throw new WeakPassword(
        "A password must contain 8 to 128 characters.",
      );
    }

    const salt = this.freshSalt();

    const verifier =
      makeVerifier(password, salt).toString("hex");

    try {
      await this.accounts.insertOne({
        _id: username,
        salt,
        verifier,
      });
    } catch (error) {
      if (
        error instanceof MongoServerError &&
        error.code === 11000
      ) {
        throw new UsernameTaken(
          "That username is already registered.",
        );
      }

      throw error;
    }

    return {
      account: username,
    };
  }

  async authenticate({
    username,
    password,
  }: {
    username: string;
    password: string;
  }) {
    const account =
      await this.accounts.findOne({
        _id: username,
      });

    if (account === null) {
      throw new InvalidCredentials(
        "The username or password is incorrect.",
      );
    }

    const stored = Buffer.from(
      account.verifier,
      "hex",
    );

    const supplied =
      makeVerifier(password, account.salt);

    if (!timingSafeEqual(stored, supplied)) {
      throw new InvalidCredentials(
        "The username or password is incorrect.",
      );
    }

    return {
      account: username,
    };
  }

  async _registered({
    username,
  }: {
    username: string;
  }) {
    const account =
      await this.accounts.findOne({
        _id: username,
      });

    return {
      registered: account !== null,
    };
  }
}
