# Contributing

## Local Development Setup

### github-app

Follow these steps if you plan on testing the github-app locally using your own private GitHub App.

1. Create a `.env` file at the project root by copying `.env.example` from the root and fill in the `SMEE_URL` variable with your smee URL. You can get a smee URL by going to [https://smee.io](https://smee.io).

2. Create a `.env.local` file in the `github-app` directory by copying `.env.example` from the `github-app` directory.

3. Create a GitHub App in your GitHub account:

    - Click on your profile -> Settings -> Developer settings -> GitHub Apps -> New GitHub App.
    - Fill in `App name`, `Homepage URL` (can be anything), `Webhook URL` (use your `SMEE_URL`, don't include "/webhook"), `Webhook secret` (can be anything).
    - Set `.env.local` -> `WEBHOOK_SECRET` to your chosen `Webhook secret`.
    - Set the following repository permissions:
        - `Issues: Read & Write`
    - Select "Only on this account".
    - Create GitHub App.
    - Generate a private key for your GitHub App and download the .pem file. Copy and paste the entire thing into `.env.local` -> `PRIVATE_KEY`.
    - Copy the `App ID` from your GitHub App and set it in `.env.local` -> `APP_ID`.
    - Click "Install App" on the left and choose any repository.

4. Run from the project root:

```bash
docker compose --profile github-app up
```

5. Start the server:

```bash
cd github-app
bun install
bun start
```

6. Create a new issue in your repository and watch the bot respond!

7. You can replay GitHub events by using the vscode debug profile "Replay Delivery". You must specify the event type and action (e.g. `issues.opened`). Previous deliveries can be found in the "Advanced" tab of your GitHub App.