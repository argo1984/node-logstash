var base_output = require('../lib/base_output'),
    util = require('util'),
    net = require('net'),
    tls = require('tls'),
    logger = require('log4node'),
    ssl_helper = require('../lib/ssl_helper'),
    error_buffer = require('../lib/error_buffer');

function AbstractTcp() {
  base_output.BaseOutput.call(this);
  this.merge_config({
    name: 'AbstractTcp',
    host_field: 'host',
    port_field: 'port',
  });
  this.merge_config(ssl_helper.config());
  this.merge_config(error_buffer.config());
}

util.inherits(AbstractTcp, base_output.BaseOutput);

AbstractTcp.prototype.abstractAfterLoadConfig = function(callback) {
  logger.info('Start output to' + this.to());

  this.error_buffer = error_buffer.create('output tcp to ' + this.host + ':' + this.port, this.error_buffer_delay, this);

  this.closed_callback = function() {};

  callback();
}

AbstractTcp.prototype.find_connection = function(callback) {
  if (this.connection) {
    return callback(this.connection);
  }
  var listener = function() {
    this.error_buffer.emit('ok');
    callback(this.connection);
  }.bind(this);

  if (this.ssl) {
    this.connection = tls.connect(ssl_helper.merge_options(this, {host: this.host, port: this.port}), listener);
  }
  else {
    this.connection = net.createConnection({host: this.host, port: this.port}, listener);
  }

  this.connection.on('error', function(err) {
    this.error_buffer.emit('error', err);
  }.bind(this));
  this.connection.on('close', function() {
    this.connection = null;
    this.closed_callback();
  }.bind(this));
}

AbstractTcp.prototype.process = function(data) {
  this.format_payload(data, function(message) {
    this.find_connection(function(c) {
      c.write(message);
    })
  }.bind(this));
}

AbstractTcp.prototype.close = function(callback) {
  logger.info('Closing output to' + this.to());
  if (this.connection) {
    this.closed_callback = function() {
      logger.info('Connection closed to' + this.to());
      callback();
    }.bind(this);
    this.connection.end();
  }
  else {
    callback();
  }
}

exports.AbstractTcp = AbstractTcp;