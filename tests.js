/*
 * Copyright (C) 2008-2016 Nabto - All Rights Reserved.
 */

/* globals cordova, nabto, NabtoError */

var GRACEPERIOD = 15; // seconds

var errors = {
  "offline": {
    "error" : {
      "event" : 1000015,
      "header" : "Device Unavailable (1000015)",
      "body" : "The requested device is currently not online. Make sure the device is turned on and is connected to the network.",
      "detail" : "nabto://offline.nabto.net/wind_speed.json?"
    }
  },

  "exception": {
    "error": {
      "event": 2000065,
      "header": "Error in device application (2000065)",
      "body": "Communication with the device succeeded, but the application on the device returned error code NP_E_NO_ACCESS",
      "detail": "NP_E_NO_ACCESS"
    }
  }
};

function assertOk(error, done, operation) {
  if (error) {
    var msg = operation + " failed with error: " + error;
    done.fail(msg);
    throw('Assertion failed: ' + msg);
  };
  expect(error).not.toBeDefined(); // mute jasmine complaints about no expectations
}


function xdescribe(title, func) {}

exports.defineAutoTests = function () {

  document.addEventListener("pause", function() {
    nabto.shutdown(function() {
      console.log("shutdown");
    });
  }, false);
  
  describe('NabtoError', function () {
    
    it('should have NabtoError available', function() {
      expect(NabtoError).toBeDefined();
    });

    it('should provide toString function', function() {
      var s = new NabtoError(NabtoError.Category.API, NabtoConstants.ClientApiErrors.API_NOT_INITIALIZED);
      expect(s).toMatch("API_NOT_INITIALIZED");
    });
    
    it('should handle api error', function() {
      var s = new NabtoError(NabtoError.Category.API, NabtoConstants.ClientApiErrors.API_NOT_INITIALIZED);
      expect(s.category).toBe(NabtoError.Category.API);
      expect(s.code).toBe(NabtoError.Code.API_NOT_INITIALIZED);
      expect(s.message).toMatch(/initialized/i);
      expect(s.inner).toBe(NabtoConstants.ClientApiErrors.API_NOT_INITIALIZED);
    });

    it('should handle ok api result with nabto error event', function() {
      var s = new NabtoError(NabtoError.Category.P2P, 0, JSON.stringify(errors.offline));
      expect(s.category).toBe(NabtoError.Category.P2P);
      expect(s.code).toBe(NabtoError.Code.P2P_DEVICE_OFFLINE);
      expect(s.message).toMatch(/not online/i);
      expect(s.inner).toEqual(errors.offline.error);
    });

    it('should handle nabto error event with device exception', function() {
      var s = new NabtoError(NabtoError.Category.P2P, 0, JSON.stringify(errors.exception));
      expect(s.category).toBe(NabtoError.Category.DEVICE_EXCEPTION);
      expect(s.code).toBe(NabtoError.Code.EXC_NO_ACCESS);
      expect(s.message).toMatch(/access denied/i);
      expect(s.inner).toEqual(errors.exception.error);
    });

    it('should gracefully handle unexpected input', function() {
      var dummy = { "foo": "bar" };
      var s = new NabtoError(NabtoError.Category.P2P, 0, JSON.stringify(dummy));
      expect(s.category).toBe(NabtoError.Category.WRAPPER);
      expect(s.code).toBe(NabtoError.Code.CDV_UNEXPECTED_DATA);
      expect(s.inner).toMatch(/unexpected object/i);
      expect(s.message).toMatch(/unexpected status/i);
    });

    function hasPrefix(s, prefix) {
      return s.substr(0, prefix.length) === prefix;
    }

    function clone(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
    
    function toNabtoEventCode(code) {
      // code = 3120;
      // event_code = 1000020
      if (Math.floor(code / 1000) != 3) {
	throw 'unexpected base for nabto event: ' + code/1000;
      }
      var base = (code - 3000);
      var major = Math.floor(base / 100) * 1000000;
      var minor = base - Math.floor((base / 100)) * 100;
      var event = major + minor;
      return event;
    }

    it('should handle nabto events correctly', function() {
      for (var p in NabtoError.Code) {
	if (NabtoError.Code.hasOwnProperty(p)) {
	  if (hasPrefix(p, "P2P_") && p !== "P2P_OTHER") {
	    var response = clone(errors.offline);
	    response.error.event = toNabtoEventCode(NabtoError.Code[p]);
	    var s = new NabtoError(NabtoError.Category.P2P, 0, JSON.stringify(response));
	    if (s.code == NabtoError.Code.P2P_OTHER) {
	      expect(p).toBe("Nabto event " + response.error.event + " not handled correctly");
	    } else {
	      expect(s.code).toBe(NabtoError.Code[p]);
	    }
          }
        }
      }
    });

    it('should provide an error message for each error code', function() {
      for (var p in NabtoError.Code) {
	if (NabtoError.Code.hasOwnProperty(p)) {
	  if (NabtoError.Message[NabtoError.Code[p]]) {
	    expect(NabtoError.Message[NabtoError.Code[p]]).toBeDefined(); // no surprise (but otherwise we get a warning)
	  } else {
	    expect(p).toBe("Missing an error message"); // clumsy way to get a custom error message to include erroneous prop
	  }
	}
      }
    });
    
  });

  describe('NabtoApiInteraction', function () {
    var testUrl = 'nabto://demo.nabto.net/wind_speed.json?';
    var testDevice = 'demo.nabto.net';
    
    it('should have a global nabto object', function() {
      expect(nabto).toBeDefined();
      expect(nabto.startupAndOpenProfile).toBeDefined();
    });

    it('starts up nabto', function(done) {
      nabto.startupAndOpenProfile(function(error) {
        assertOk(error, done, "startupAndOpenProfile");
        expect(error).not.toBeDefined();
        done();
      });
    });

    it('can call startup multiple times', function(done) {
      // Wait a little for nabto startup to completely finish
      nabto.shutdown(function(error) {
        assertOk(error, done, "shutdown");
        setTimeout(function() {
          nabto.startupAndOpenProfile(function(error) {
            assertOk(error, done, "startupAndOpenProfile");
            nabto.startupAndOpenProfile(function(error) {
              assertOk(error, done, "startupAndOpenProfile (2)");
              done();
            });
          });
        }, 200);
      });
    });
    
    it('shuts down nabto', function(done) {
      nabto.shutdown(function(error) {
        assertOk(error, done, "shutdown");
        done();
      });
    });

    it('can call shutdown multiple times', function(done) {
      nabto.shutdown(function(error) {
        assertOk(error, done, "shutdown");
        nabto.shutdown(function(error) {
          assertOk(error, done, "shutdown (2)");
          done();
        });
      });
    });

    it('can invoke static resource dir config change', function(done) {
      nabto.startup(function(error) {
        assertOk(error, done, "startup");
        nabto.setStaticResourceDir(cordova.file.dataDirectory, function(error) {
          assertOk(error, done, "setStaticResourceDir");
          done();
        });
      });
    });
    
    it('cannot invokeRpc with non-open nabto', function(done) {
      nabto.shutdown(function(error) {
        assertOk(error, done, "shutdown");
        nabto.prepareInvoke([testDevice],function(error) {
          nabto.rpcInvoke(testUrl, function(error, result) {
            expect(error.code).toBe(NabtoError.Code.API_NOT_INITIALIZED);
            done();
          });
        });
      });
    });

    it('gets error with invalid arguments to rpcInvoke', function(done) {
      nabto.rpcInvoke(123, function(error, result) {
        expect(result).not.toBeDefined();
        expect(error.code).toBe(NabtoError.Code.CDV_INVALID_ARG);
        done();
      });
    });
    
    it('api error with invalid username', function(done) {
      nabto.startupAndOpenProfile('nonexisting', '1234567', function(error, result) {
        expect(result).not.toBeDefined();
        expect(error.code).toBe(NabtoError.Code.API_OPEN_CERT_OR_PK_FAILED);
        done();
      });
    });

    if (device.platform === 'browser') {
      it('api error with invalid password - fails in all but stub', function(done) {
	nabto.startupAndOpenProfile('bad_password', 'hesthest', function(error, result) {
          expect(result).not.toBeDefined();
          expect(error.code).toBe(NabtoError.Code.API_UNLOCK_KEY_BAD_PASSWORD);
          done();
	});
      });
    }

    it('starts up nabto with username/password', function(done) {
      nabto.startupAndOpenProfile('guest', 'blank', function(error) {
        assertOk(error, done, "startupAndOpenProfile");
        done();
      });
    });

    it('sets a valid interface without error messages', function(done) {
      var interfaceXml = "<unabto_queries><query name='wind_speed.json' id='2'><request></request><response format='json'><parameter name='speed' type='uint32'/></response></query></unabto_queries>";
      nabto.rpcSetDefaultInterface(interfaceXml, function(error, result) {
        assertOk(error, done, "rpcSetDefaultInterface");
        done();
      });
    });

    it('invokes an rpc function', function(done) {
      var interfaceXml = "<unabto_queries><query name='wind_speed.json' id='2'><request></request><response format='json'><parameter name='speed_m_s' type='uint32'/></response></query></unabto_queries>";
      nabto.shutdown(function(error) { // clear session singleton to ensure working profile is used
        nabto.startupAndOpenProfile(function() {
          nabto.rpcSetDefaultInterface(interfaceXml, function(error, result) {
            assertOk(error, done, "rpcSetDefaultInterface");
            nabto.prepareInvoke(["demo.nabto.net"], function(error) {
              assertOk(error, done, "prepareInvoke");
              nabto.rpcInvoke("nabto://demo.nabto.net/wind_speed.json?", function(error, result) {
                assertOk(error, done, "rpcInvoke");
                expect(result.response).toBeDefined();
                expect(result.response.speed_m_s).toBeDefined();
                done();
	      });
            });
          });
        });
      });
    });
    
    it('returns json error when invoking rpc without interface being set', function(done) {
      nabto.shutdown(function() { // clear session singleton to ensure working profile is used
        nabto.startupAndOpenProfile(function() {
          nabto.prepareInvoke(['demo.nabto.net'], function(error, result) {
            nabto.rpcInvoke('nabto://demo.nabto.net/test.json', function(error, result) {
              expect(error).toBeDefined();
              expect(error.code).toBe(NabtoError.Code.P2P_RPC_INTERFACE_NOT_SET);
              expect(result).not.toBeDefined();
              done();
            });
          });
        });
      });
    });

    it('returns an rpc error when invoking an offline device', function(done) {
      var interfaceXml = "<unabto_queries><query name='wind_speed.json' id='2'><request></request><response format='json'><parameter name='speed_m_s' type='uint32'/></response></query></unabto_queries>";
      nabto.shutdown(function(error) { // clear session singleton to ensure working profile is used
        nabto.startupAndOpenProfile(function() {
          nabto.rpcSetDefaultInterface(interfaceXml, function(error, result) {
            assertOk(error, done, "rpcSetDefaultInterface");
            nabto.prepareInvoke(["offline-error-216b3ea2.nabto.net"], function(error) {
              nabto.rpcInvoke('nabto://offline-error-216b3ea2.nabto.net/wind_speed.json', function(error, result) {
                expect(error).toBeDefined();
                expect(error.code).toBe(NabtoError.Code.P2P_DEVICE_OFFLINE);
                expect(result).not.toBeDefined();
                done();
              });
            });
          });
        });
      });
    });

    it('returns a device exception when rpc invoking an unexisting function on device', function(done) {
      var interfaceXml = "<unabto_queries><query name='wind_speed.json' id='87'><request></request><response format='json'><parameter name='speed_m_s' type='uint32'/></response></query></unabto_queries>";
      nabto.shutdown(function(error) { // clear session singleton to ensure working profile is used
        nabto.startupAndOpenProfile(function() {
          nabto.rpcSetDefaultInterface(interfaceXml, function(error, result) {
            assertOk(error, done, "rpcSetDefaultInterface");
            nabto.prepareInvoke(["demo.nabto.net"], function(error) {});
            nabto.rpcInvoke('nabto://demo.nabto.net/wind_speed.json', function(error, result) {
              expect(error).toBeDefined();
              expect(error.code).toBe(NabtoError.Code.EXC_INV_QUERY_ID);
              expect(result).not.toBeDefined();
              done();
            });
          });
        });
      });
    });
    
    it('can get active session token', function(done) {
      nabto.getSessionToken(function(error, token) {
        assertOk(error, done, "getSessionToken");
        expect(typeof token).toBe('string');
        expect(token.length).toBe(44);
        done();
      });
    });

    it('can get local nabto devices', function(done) {
      nabto.getLocalDevices(function(error, devices) {
        assertOk(error, done, "getLocalDevices");
        expect(Object.prototype.toString.call(devices)).toBe('[object Array]');
        if (devices.length > 0) {
          devices.map(function(device) {
            expect(typeof device).toBe('string');
          });
        }
        else {
          console.log('There were no local nabto devices to test discover');
        }
        done();
      });
    });

    it('can return nabto client version', function(done) {
      nabto.version(function(error, version) {
        assertOk(error, done, "version");
        expect(version[0]).toBe('4');
        expect(version[1]).toBe('.');
        expect(version[2]).toBeDefined();
        expect(version[3]).not.toBeDefined();
        done();
      });
    });

    it('can return nabto client version string', function(done) {
      nabto.versionString(function(error, version) {
        assertOk(error, done, "versionString");
        expect(version[0]).toBe('4');
        expect(version[1]).toBe('.');
        expect(version[2]).toBeDefined();
        expect(version[3]).toBe('.');
        expect(version[4]).toBeDefined();
        done();
      });
    });

    it('shuts down nabto', function(done) {
      nabto.shutdown(function(error) {
        assertOk(error, done, "shutdown");
        done();
      });
    });

    it('rpcInvoke fails when not calling prepareInvoke', function(done){
      nabto.startupAndOpenProfile('guest', 'blank', function(error) {
        assertOk(error, done, "startupAndOpenProfile");
        nabto.rpcInvoke("nabto://demo.nabto.net/wind_speed.json?", function(error, result) {
          expect(error).toBeDefined();
          expect(error.code).toBe(NabtoError.Code.P2P_MISSING_PREPARE);
          expect(result).not.toBeDefined();
          nabto.shutdown(function(error) {
            done();
          });
        });
      });
    });

    it('rpcInvoke fails when prepareInvoke called with wrong device', function(done){
      nabto.startupAndOpenProfile('guest', 'blank', function(error) {
        nabto.prepareInvoke(["wrong.device.id"], function(error){
          nabto.rpcInvoke("nabto://demo.nabto.net/wind_speed.json?", function(error, result) {
            expect(result).not.toBeDefined();
            expect(error).toBeDefined();
            nabto.shutdown(function(error) {
              done();
            });
	  });
        });
      });
    });

  });

//  describe('Debug', function () {
  
  it('creates signed certificate', function(done){
    nabto.startup(function(error) {
      // exercise setOption (set bad value, re-construct defaults)
      nabto.setOption("urlPortalDomain", "com", function(error) {
        assertOk(error, done, "setOption");
        nabto.setOption("urlPortalHostName", "www.google", function(error) {
          assertOk(error, done, "setOption");
          nabto.createSignedKeyPair("stresstest@nabto.com", "12345678", function(error) {
            expect(error).toBeDefined(); // expect fail: google.com cannot issue cert
            nabto.setOption("urlPortalHostName", "webservice.nabto", function(error) {
              expect(error).not.toBeDefined();
              nabto.createSignedKeyPair("stresstest@nabto.com", "12345678", function(error) {
                assertOk(error, done, "createSignedKeyPair");
                expect(error).not.toBeDefined(); // expect ok after setting back to default
                done();
              });
            });
          });
        });
      });
    });
  });

  it('creates a self-signed certificate and can remove it again', function(done) {
    var id = 'user_' + new Date().getMilliseconds();
    var password = 'secret';
    nabto.startupAndOpenProfile(id, password, function(error) {
      expect(error).toBeDefined();
      expect(error.code).toBe(NabtoError.Code.API_OPEN_CERT_OR_PK_FAILED);
      nabto.createKeyPair(id, password, function(error) {
        assertOk(error, done, "createKeyPair");
        nabto.startupAndOpenProfile(id, password, function(error) {
          assertOk(error, done, "startupAndOpenProfile");
          nabto.shutdown(function(error) { // remove singleton session
            assertOk(error, done, "shutdown");
            nabto.startup(function(error) {
              nabto.removeKeyPair(id, function(error) {
                assertOk(error, done, "removeKeyPair");
                nabto.startupAndOpenProfile(id, password, function(error) {
                  expect(error).toBeDefined();
                  expect(error.code).toBe(NabtoError.Code.API_OPEN_CERT_OR_PK_FAILED);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });
  
  it('handles certs with plus signs in the name', function(done) {
    var id = 'foo+bar@baz-' + new Date().getMilliseconds() + '.org' ;
    var password = 'secret';
    nabto.createKeyPair(id, password, function(error) {
      assertOk(error, done, "createKeyPair");
      nabto.startupAndOpenProfile(id, password, function(error) {
        assertOk(error, done, "startupAndOpenProfile");
        nabto.removeKeyPair(id, function(error) {
          assertOk(error, done, "removeKeyPair");
          done();
        });
      });
    });
  });

  it('sets basestation auth info', function(done) {
    nabto.startupAndOpenProfile('guest', 'blank', function(error) {
      assertOk(error, done, "startupAndOpenProfile");
      nabto.setBaseStationAuthJson("{ \"foo\": \"bar\" }", function(error) {
        assertOk(error, done, "setBaseStationAuthJson");
        nabto.setBaseStationAuthJson("", function(error) {
          assertOk(error, done, "setBaseStationAuthJson (2)");
          done();
        });
      });
    });
  });
  
  it('opens a tunnel to demo host with valid parameters and closes tunnel again', function(done) {
    nabto.shutdown(function(error) { // clear session singleton to ensure working profile is used
      assertOk(error, done, "shutdown");
      nabto.startupAndOpenProfile('guest', 'blank', function(error) {
        assertOk(error, done, "startupAndOpenProfile");
        nabto.tunnelOpenTcp("streamdemo.nabto.net", 80, function(error, tunnel) {
          assertOk(error, done, "tunnelOpenTcp");
          expect(tunnel).toBeDefined();
          nabto.tunnelPort(tunnel, function(error, ephPort) {
            assertOk(error, done, "tunnelPort");
            expect(ephPort).toBeDefined();
            expect(ephPort).toBeGreaterThan(1000);
            var url1 = 'http://127.0.0.1:' + ephPort + '/?cache-blah-foo=' + new Date().getMilliseconds();
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
              if (xhttp.readyState !== 4) { return; }
              expect(xhttp.status).toBe(200);
              expect(xhttp.responseText).toContain('Serve a large file');
              xhttp.abort();
              
              nabto.tunnelClose(tunnel, function(error) {
                assertOk(error, done, "tunnelClose");
                
                // verify that we can no longer connect to tunnel (it takes a little while to close
                // it completely)
                setTimeout(function() {
                  var xhttp2 = new XMLHttpRequest();
                  xhttp2.onreadystatechange = function() {
                    if (xhttp2.readyState !== 4) { return; }
                    expect(xhttp2.status).toBe(0);
                    expect(xhttp2.responseText).toBe('');
                    done();
                  };
                  var url2 = 'http://127.0.0.1:' + ephPort + '/?cache-blah-foo=' + new Date().getMilliseconds();
                  xhttp2.open('GET', url2, true);
                  xhttp2.send();
                }, 250);
              });
            };
            xhttp.open('GET', url1, true);
            xhttp.send();
          });
        });
      });
    });
  });

  function assertErrorIsInvalidTunnel(error) {
    expect(error).toBeDefined();
    expect(error.category).toBe(NabtoError.Category.API);
    expect(error.code).toBe(NabtoError.Code.API_INVALID_TUNNEL);
  }

  function assertErrorIsInvalidInput(error) {
    expect(error).toBeDefined();
    expect(error.category).toBe(NabtoError.Category.WRAPPER);
    expect(error.code).toBe(NabtoError.Code.CDV_INVALID_ARG);
  }

  it('handles offline tunnel host and retrieves correct error code ', function(done) {
    nabto.startupAndOpenProfile('guest', 'blank', function(error) {
      assertOk(error, done, "startupAndOpenProfile");
      nabto.tunnelOpenTcp(new Date().getMilliseconds() + "veryoffline.nabto.net", 80, function(error, tunnel) {
        assertErrorIsInvalidTunnel(error);
        done();
      });
    });
  });

  it('handles empty tunnel host input', function(done) {
    nabto.startupAndOpenProfile('guest', 'blank', function(error) {
      assertOk(error, done, "startupAndOpenProfile");
      nabto.tunnelOpenTcp("", 80, function(error, tunnel) {
        assertErrorIsInvalidInput(error);
        done();
      });
    });
  });
    
  it('handles bad tunnel port input 1', function(done) {
    nabto.startupAndOpenProfile('guest', 'blank', function(error) {
      assertOk(error, done, "startupAndOpenProfile");
      nabto.tunnelOpenTcp("streamdemo.nabto.net", -80, function(error, tunnel) {
        assertErrorIsInvalidInput(error);
        done();
      });
    });
  });

  it('handles bad tunnel port input 2', function(done) {
    nabto.startupAndOpenProfile('guest', 'blank', function(error) {
      assertOk(error, done, "startupAndOpenProfile");
      nabto.tunnelOpenTcp("streamdemo.nabto.net", "bad", function(error, tunnel) {
        assertErrorIsInvalidInput(error);
        done();
      });
    });
  });


  it('handles get port on an invalid tunnel', function(done) {
    nabto.startupAndOpenProfile('guest', 'blank', function(error) {
      nabto.tunnelPort("foo", function(error) {
        assertErrorIsInvalidTunnel(error);
        nabto.tunnelPort("", function(error) {
          assertErrorIsInvalidTunnel(error);
          nabto.tunnelPort(undefined, function(error) {
            assertErrorIsInvalidTunnel(error);
            done();
          });
        });
      });
    });
  });
    
  it('handles get state on an invalid tunnel', function(done) {
    nabto.startupAndOpenProfile('guest', 'blank', function(error) {
      nabto.tunnelState("foo", function(error) {
        expect(error).toBeDefined();
        nabto.tunnelState("", function(error) {
          expect(error).toBeDefined();
          nabto.tunnelState(undefined, function(error) {
            expect(error).toBeDefined();
            done();
          });
        });
      });
    });
  });

}; // suite

exports.defineManualTests = function(contentEl, createActionButton) {
  // PrepareInvoke tests use free devices if not specified
  var s = ["test.ampg3f.appmyproduct.com","test2.sfyfaf.appmyproduct.com"];
  
  createActionButton('PrepareInvoke with free and own-it device', function() {
    var t = ["test.amp-o.appmyproduct.com","test.ampstf.appmyproduct.com"];
    nabto.startup();
    nabto.prepareInvoke(t);
    nabto.shutdown();
    console.log("expected result: ad should be shown if test ran outside of grace period");
  });
  createActionButton('PrepareInvoke with free devices only', function() {
    nabto.startup();
    nabto.prepareInvoke(s);
    nabto.shutdown();
    console.log("expected result: ad should be shown if test ran outside of grace period");
  });
  createActionButton('PrepareInvoke called twice within grace period', function() {
    console.log("test running");
    nabto.startup(); 
    nabto.prepareInvoke(s);
    setTimeout(function(){
      nabto.prepareInvoke(s);
      nabto.shutdown();
      console.log("Test done: ad should have been shown only once and only if test ran outside of grace period");
    }, 5000);
  });
  createActionButton('PrepareInvoke called twice within grace period w. shutdown between', function() {
    console.log("test running");
    nabto.startup(); 
    nabto.prepareInvoke(s);
    nabto.shutdown();
    setTimeout(function(){
      nabto.prepareInvoke(s);
      nabto.shutdown();
      console.log("Test done: ad should have been shown only once and only if test ran outside of grace period");
    }, 5000);
  });
  createActionButton('PrepareInvoke called twice w. interval greater than grace period', function() {
    console.log("test running");
    nabto.startup(); 
    nabto.prepareInvoke(s);
    setTimeout(function(){
      nabto.prepareInvoke(s);
      nabto.shutdown();
      console.log("Test done: ad should have been shown only once and only if test ran outside of grace period");
    }, (GRACEPERIOD+1)*1000);
  });
  createActionButton('PrepareInvoke called twice w. interval greater than grace period and shutdown between', function() {
    console.log("test running");
    nabto.startup(); 
    nabto.prepareInvoke(s);
    nabto.shutdown();
    setTimeout(function(){
      nabto.prepareInvoke(s);
      nabto.shutdown();
      console.log("Test done: ad should have been shown twice with grace period in between, and only once after the grace period if test ran inside of grace period");
    }, (GRACEPERIOD+1)*1000);
  });
  createActionButton('PrepareInvoke with own-it devices only', function() {
    var t = ["test.ampfso.appmyproduct.com","test.amp2fo.appmyproduct.com"];
    nabto.startup();
    nabto.prepareInvoke(t);
    nabto.shutdown();
    console.log("expected result: ad should not be shown");
  });
  createActionButton('PrepareInvoke with non-amp device', function() {
    var t = ["test.nabto.com","test2.nabto4.net"];
    nabto.startup();
    nabto.prepareInvoke(t);
    nabto.shutdown();
    console.log("expected result: ad should not be shown");
  });
  createActionButton('PrepareInvoke with invalid device', function() {
    var t = ["test.asf-sfa.asf-f.nabto.com","testcom"];
    nabto.startup();
    nabto.prepareInvoke(t);
    nabto.shutdown();
    console.log("expected result: ad should not be shown");
  });
  createActionButton('PrepareInvoke with empty list', function() {
    var t = [];
    nabto.startup();
    nabto.prepareInvoke(t);
    nabto.shutdown();
    console.log("expected result: ad should not be shown");
  });
  createActionButton('RpcInvoke', function() {
    nabto.startup();
    nabto.rpcInvoke("nabto://demo.nabto.net/wind_speed.json?", function(error, result) {
      console.log('error=' + error + ' +, result=' + result);
    });
    nabto.shutdown();
    console.log("expected result: ad should not be shown");
  });
  
};

