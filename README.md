# JetStream Debugger

This web application that allows you to debug your JetStream applications.

## Pre-requisites

- JetStream should have WebSockets enabled
- Connects to the JetStream ws://localhost:444, so this port should be exposed via Docker or k8s

## Running

- `git clone`/`git pull`
- `yarn install`
- `yarn build`
- `yarn serve`
- Open http://localhost:4173/apollo-jetstream/
- Alternatively, you can run navigate to https://mihcom.github.io/apollo-jetstream/ which is the latest build
