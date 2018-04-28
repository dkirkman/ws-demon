import React, { Component } from 'react';
import './demon.css'
import chroma from 'chroma-js';

class Demon extends Component {
  constructor(props) {
    super(props);

    this.go_update = this.go_update.bind(this);
    this.set_color = this.set_color.bind(this);
    this.initialize_colormap = this.initialize_colormap.bind(this);
    this.set_cyclic_brightness = this.set_cyclic_brightness.bind(this);
    this.myRef = React.createRef();

    // Don't do anything else if we don't actually have a window to draw in
    // (e.g. server side).  Only have to protect this in the constructor, 
    // everything else happens when the component mounts, and that won't happen
    // if we don't have window
    if (typeof window !== 'undefined') {     
      this.dat = require('dat.gui');
      
      this.width =  640;
      this.height = 480;

      // scales for the cyclic_brightness map
      this.scale_left  = chroma.scale(['black','red','white']).correctLightness();
      this.scale_right = chroma.scale(['black','blue','white']).correctLightness();     
      
      this.params = {'num_states': 16,
		     'neighborhood': 'von Neumann',
		     reset: () => this.initialize_state(),		   
		     'colormap': 'cyclic brightness',
		     'frameDelay': 20,
                     'run': false,
                     justInitialized: false,
                     stopped: false
		    };
      
      this.gui = new this.dat.default.GUI();
      this.gui.add(this.params, 'num_states', 
                   5, 30).onFinishChange(val => {
                     this.params.num_states = Math.round(val);
                     this.initialize_state();
                   });
      this.gui.add(this.params, 'neighborhood', ['von Neumann', 'Moore']);
      this.gui.add(this.params, 'colormap', ['grayscale',
                                             'cyclic grayscale',
                                             'cyclic rainbow',
                                             'cyclic brightness'])
        .onFinishChange(val => {
          this.initialize_colormap();
        });
      this.gui.add(this.params, 'frameDelay', 0, 50);
      this.gui.add(this.params, 'run');
      this.gui.add(this.params, 'reset');
    }
  }

  componentDidMount() {
    this.create_dom_elements_and_go();
  }

  componentWillUnmount() {
    this.params.stopped = true;
  }

  set_grayscale(nval) {
    return {'red':   nval*255,
            'green': nval*255,
            'blue':  nval*255
           };
  }
  
  set_cyclic_grayscale(nval) {
    nval = nval * 2;
    if (nval >= 1.0) nval = 2.0-nval;

    let val = nval*255;

    return {'red':   val,
            'green': val,
            'blue':  val
           };
  }

  set_cyclic_brightness(nval) {
    nval = nval * 2;
    
    var color;
    if (nval < 1) {
      color = this.scale_left(nval);
    } else {
      nval = 2.0 - nval;
      color = this.scale_right(nval);
    }

    return {'red':   color.get('rgb.r'),
            'green': color.get('rgb.g'),
            'blue':  color.get('rgb.b')
           };
  }

  set_cyclic_rainbow(nval) {
    let red = 0;
    let green = 0;
    let blue = 0;
    
    function interp(val) {
      let sval = Math.sin(val*Math.PI/2.0);
      return Math.round(sval*255);
    }

    if (nval < 1.0/6.0) {
      red = 255;
      blue = 0;
      
      let frac = nval * 6.0;
      green = interp(frac);
    } else if (nval < 2.0/6.0) {
      green = 255;
      blue = 0;
      
      let frac = (nval-1.0/6.0) * 6.0;
      red = interp(1.0-frac);
    } else if (nval < 3.0/6.0) {
      green = 255;
      red = 0;
      
      let frac = (nval-2.0/6.0) * 6.0;
      blue = interp(frac);
    } else if (nval < 4.0/6.0) {
      blue = 255;
      red = 0;
      
      let frac = (nval-3.0/6.0) * 6.0;
      green = interp(1.0-frac);
    } else if (nval < 5.0/6.0) {
      blue = 255;
      green = 0;
      
      let frac = (nval-4.0/6.0) * 6.0;
      red = interp(frac);
    } else {
      red = 255;
      green = 0;
      
      let frac = (nval-5.0/6.0) * 6.0;
      blue = interp(1.0-frac);
    }

    return {'red':   red,
            'green': green,
            'blue':  blue
           };
  }

  set_color(data, offset, value, max_value) {
    // just move into where it's used, now trival ...
    data[offset+0] = this.color_red[value];
    data[offset+1] = this.color_green[value];
    data[offset+2] = this.color_blue[value];
    data[offset+3] = 255;
  }
  
  initialize_colormap() {
    this.color_red = new Uint8Array(this.params.num_states);
    this.color_green = new Uint8Array(this.params.num_states);
    this.color_blue = new Uint8Array(this.params.num_states);

    let colormap = this.set_grayscale;
    if (this.params.colormap == "cyclic grayscale") {
      colormap = this.set_cyclic_grayscale;
    } else if (this.params.colormap == "cyclic rainbow") {
      colormap = this.set_cyclic_rainbow;
    } else if (this.params.colormap == "cyclic brightness") {
      colormap = this.set_cyclic_brightness;
    }
    var i, nval, color;
    for (i=0; i<this.params.num_states; ++i) {
      nval = i/this.params.num_states;
      color = colormap(nval);
      this.color_red[i] = color.red;
      this.color_green[i] = color.green;
      this.color_blue[i] = color.blue;
    }

    this.params.justInitialized = true;
  }

  initialize_state() {
    for (var i=0; i<this.view.length; ++i) {
      this.view[i] = Math.round(Math.random() * (this.params.num_states-1));
      this.view2[i] = this.view[i];
    }
    this.params.justInitialized = true;

    this.initialize_colormap();
  }
  
  swap_buffers() {
    let tbuf = this.buffer;
    let tview = this.view;
    
    this.buffer = this.buffer2;
    this.view = this.view2;
    
    this.buffer2 = tbuf;
    this.view2 = tview;
  };
    
  update_view() {
    const params = this.params;
    const width = this.width;
    const height = this.height;
    const view = this.view;
    let view2 = this.view2;

    function wrap_x(x) {
      if (x < 0) return width-1;
      if (x > width-1) return 0;
      return x;
    }
    
    function wrap_y(y) {
      if (y < 0) return height-1;
      if (y > height-1) return 0;
      return y;
    };
    
    function can_eat(val1, val2) {
      if (val1 == 0 && val2 == params.num_states-1) return true;
      return (val1 == val2 + 1);
    }

    function pix_value(x, y) {    
      let val = view[y*width + x];
      
      let val1 = view[wrap_y(y)*width + wrap_x(x+1)];
      if (can_eat(val1, val)) return val1;
      
      let val2 = view[wrap_y(y)*width + wrap_x(x-1)];
      if (can_eat(val2, val)) return val2;
      
      let val3 = view[wrap_y(y+1)*width + wrap_x(x)];
      if (can_eat(val3, val)) return val3;
      
      let val4 = view[wrap_y(y-1)*width + wrap_x(x)];
      if (can_eat(val4, val)) return val4;
      
      if (params.neighborhood == 'Moore') {
        let val5 = view[wrap_y(y+1)*width + wrap_x(x+1)];
        if (can_eat(val5, val)) return val5;
        
        let val6 = view[wrap_y(y+1)*width + wrap_x(x-1)];
        if (can_eat(val6, val)) return val6;
        
        let val7 = view[wrap_y(y-1)*width + wrap_x(x+1)];
        if (can_eat(val7, val)) return val7;
        
        let val8 = view[wrap_y(y-1)*width + wrap_x(x-1)];
        if (can_eat(val8, val)) return val8;  
      }
      return val;
    }
    
    for (var y=0; y<height; ++y) {
      for (var x=0; x<width; ++x) {
	view2[y*width+x] = pix_value(x, y);
      }
    }
    
    this.swap_buffers();
  }
  
  go_update() {
    if (this.params.run || this.params.justInitialized) {
      for (var y=0; y<this.height; ++y) {
	for (var x=0; x<this.width; ++x) {
	  let pix_offset = (y*this.width + x)*4;
	  this.set_color(this.data, pix_offset, this.view[x+y*this.width],
		         this.params.num_states);
	}
      }
      this.context.putImageData(this.image_data, 0, 0);	    
      this.update_view();
      this.params.justInitialized = false;
    }
    
    if (!this.params.stopped) {
      if (this.params.run) {
        setTimeout(this.go_update, this.params.frameDelay);
      } else {
        // don't spin continuously looking for run to be turned on,
        // but do check a few times a second ...
        setTimeout(this.go_update, 50);
      }
    }
  }

  create_dom_elements_and_go() {    
    this.demon_div = this.myRef.current;
    this.canvas = document.createElement('canvas');
    
    this.buffer = new ArrayBuffer(this.width*this.height);
    this.view = new Uint8Array(this.buffer);
    this.buffer2 = new ArrayBuffer(this.width*this.height);
    this.view2 = new Uint8Array(this.buffer2);
    
    if (this.canvas.getContext) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.canvas.style['margin-left'] = 'auto';
      this.canvas.style['margin-right'] = 'auto';
      this.canvas.style['display'] = 'block';
      
      let canvas_div = document.createElement('div');
      let control_div = document.createElement('div');
      
      this.demon_div.appendChild(control_div);
      this.demon_div.appendChild(canvas_div);
      
      canvas_div.appendChild(this.canvas);
      
      control_div.appendChild(this.gui.domElement);
      control_div.style.float = 'right';
      control_div.style.height = '0';
      control_div.style['z-index'] = 1;
      
      control_div.style.position = 'relative';
      
      control_div.style['margin-bottom'] = '0';
      this.gui.domElement.style['margin-bottom'] = '0';
      this.demon_div.style['line-height'] = '1rem';
      
      this.context = this.canvas.getContext('2d');
      this.image_data = this.context.createImageData(this.width, this.height);
      this.data = this.image_data.data;

      this.initialize_state();
      this.go_update();
      
    } else {
      // canvas not supported, not a lot to do ...
    }
  }
    
  render() {
    return <div className="demon" ref={this.myRef}></div>;    
  }
}

export default Demon;
