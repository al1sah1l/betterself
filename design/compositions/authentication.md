# Authentication

A new user [registers with a username and password and receives a session](reaction:BetterSelf.authentication.Register).

An existing user [signs in with valid credentials and receives a session](reaction:BetterSelf.authentication.SignIn).

A client with an existing session can [resolve that session to the authenticated account](reaction:BetterSelf.authentication.CurrentUser).

A signed-in user can [end the current session](reaction:BetterSelf.authentication.SignOut).

Authentication determines the account identity before a session is created. Other BetterSelf endpoints use the session rather than accepting a user identity directly from the client.

```endpoints
BetterSelf.authentication.Register at /auth/register
BetterSelf.authentication.SignIn at /auth/sign-in
BetterSelf.authentication.CurrentUser at /auth/current
BetterSelf.authentication.SignOut at /auth/sign-out
```