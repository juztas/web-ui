# OpenFlow Next Generation - Web User Interface 

## Debian Instructions

This is a component of of-ng project. This component is responsible for display
network topology in a GUI to users. Also control some basic operations like
list, insert and remove flows.

## Install

All the /api/ endpoint requests are redirected to a wsgi python app. Everything
else are static files. But we host all ("/api/" endpoint and static files) under
apache, in a virtualhost settings.

### Installing Apache2

```
$ sudo apt-get install apache2 libapache2-mod-wsgi
```

### Downloading the source code

```
$ sudo mkdir -p /var/www/ofng/
$ cd /var/www/ofng
$ sudo git clone https://github.com/of-ng/web-ui.git
$ cd web-ui/
```

### Create the Apache virtualhost

Copy, or create a symlink of Apache config file to your apache default config
dir:

```
$ sudo ln -s /var/www/ofng/web-ui/apache.conf /etc/apache2/sites-enabled/ofng.conf
```

Edit this file and change `yourdomain.com` to your webserver domain.

### Install dependencies

```
$ sudo pip install -r requirements.txt
```

### Edit your config file

Edit the file `settings/production.py` and configure the variables
properly.


## Restart apache

```
$ sudo service apache2 restart
```

## Test it

Point your browser to `http://ofng.yourdomain.com`.


## Red Hat Instructions

This is a component of of-ng project. This component is responsible for display
network topology in a GUI to users. Also control some basic operations like
list, insert and remove flows.

### Installing Apache

```
$ sudo yum -y install httpd mod_wsgi
```

### Downloading the source code

```
$ sudo mkdir -p /var/www/ofng/
$ cd /var/www/ofng
$ sudo git clone https://github.com/of-ng/web-ui.git
$ cd web-ui/
```

### Create the Apache virtualhost

Run the following command to add virtual host to apache.

```
$ sudo cat /var/www/ofng/web-ui/apache.conf >> /etc/httpd/conf/httpd.conf
```

Edit this file and change `yourdomain.com` to your webserver domain.

### Install dependencies
Red Hat release 6 and older use python 2.6 by default. To install python 2.7, please refer to [this site](https://goo.gl/AcGhBe)

```
$ sudo pip install -r requirements.txt
```

### Edit your config file

Edit the file `settings/production.py` and configure the variables
properly.


## Restart apache

```
$ sudo service http restart
```

## Test it

Point your browser to `http://ofng.yourdomain.com`.

## Authors

This is a collaborative project between SPRACE (From São Paulo State University
- Unesp) and Caltech (California Institute of Technology).

For a complete list of people, please see the AUTHORS.md file.
