# README

This is a component of of-ng project. This component is responsible for display
network topology in a GUI to users. Also control some basic operations like
list, insert and remove flows.

# Install

All the /api/ endpoint requests are redirected to a wsgi python app. Everything
else are static files. But we host all ("/api/" endpoint and static files) under
apache, in a virtualhost settings.

## Debian-Like

```
$ sudo pip install -r requirements.txt
```
