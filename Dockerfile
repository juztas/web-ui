############################################################
# Dockerfile to build OFNG Web UI Container Based on Ubuntu
############################################################

# Set the base image to Ubuntu
FROM ubuntu

# File Author / Maintainer
MAINTAINER Jensen Zhang <jingxuan.n.zhang@gmail.com>

# Update the sources list
RUN apt-get update

# Install basic applications
RUN apt-get install -y tar git curl vim wget dialog net-tools build-essential

# Install Python and Basic Python Tools
RUN apt-get install -y python python-dev python-distribute python-pip librrd-dev

# Install Apache and WSGi Mod
RUN apt-get install -y apache2 libapache2-mod-wsgi

# Create mount point for web ui
RUN mkdir -p /var/www/ofng/web-ui

# Alias Apache Configuration
RUN ln -s /var/www/ofng/web-ui/apache.conf /etc/apache2/sites-enabled/ofng.conf

# Install dependencies
ADD requirements.txt /requirements.txt
RUN pip install -r /requirements.txt
RUN git clone https://github.com/snlab/python-odl.git && cd python-odl && python setup.py install

CMD service apache2 restart
