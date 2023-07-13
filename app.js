let midi = null;
let delugeIn = null;
let delugeOut = null;

function $(name) {
  return document.getElementById(name)
}

function setstatus(text) {
  $("midiStatus").innerText = text
}

function onMIDISuccess(midiAccess) {
  setstatus("webmidi ready");
  midi = midiAccess; // store in the global (in real usage, would probably keep in an object instance)
}

function onMIDIFailure(msg) {
  setstatus(`Failed to get MIDI access :( - ${msg}`);
}

window.addEventListener('load', function() {
  decode(testdata)
  return;

  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({ sysex: true }).then( onMIDISuccess, onMIDIFailure );
  } else {
    setstatus("webmidi unavail, check browser permissions");
  }

  $("connectButton").addEventListener("click", connect)
  $("getOledButton").addEventListener("click", getOled)
});

function connect() {
   for (const entry of midi.inputs) {
    const input = entry[1];
    console.log(
      `Input port [type:'${input.type}']` +
        ` id:'${input.id}'` +
        ` manufacturer:'${input.manufacturer}'` +
        ` name:'${input.name}'` +
        ` version:'${input.version}'`,
    );

     if (input.name.includes("Deluge MIDI 3")) {
       delugeIn = input;
     }
  }

  for (const entry of midi.outputs) {
    const output = entry[1];
    console.log(
      `Output port [type:'${output.type}'] id:'${output.id}' manufacturer:'${output.manufacturer}' name:'${output.name}' version:'${output.version}'`,
    );

     if (output.name.includes("Deluge MIDI 3")) {
       delugeOut = output;
     }
  }

  if (delugeIn != null && delugeOut != null) {
    setstatus("found deluge!");
    delugeIn.addEventListener("midimessage",  handleData);
    delugeOut.send([0xf0, 0x7d, 0x00, 0xf7]);
  } else {
    setstatus("no deluge.");
  }
}

function getOled() {
    delugeOut.send([0xf0, 0x7d, 0x02, 0x00, 0x01, 0xf7]);
}

let lastmsg

function handleData(msg) {
  lastmsg = msg
  console.log(msg.data);
  setstatus("found deluge! got some data.");
  if (msg.data.length > 8) {
    $("dataLog").innerText = "size: " + msg.data.length
  }
  decode(msg.data)
}

testdata = new Uint8Array ([
    240, 125, 2, 64, 1, 0, 126, 127, 0, 102, 0, 66, 76, 71, 18, 44, 100, 0, 6, 8, 112, 36, 8, 6, 0, 126, 8, 16, 16, 32, 126, 0, 68, 2, 67, 126, 68, 2, 2, 0, 126, 70, 16, 67, 126, 126, 127, 0, 114, 0, 71, 64, 72, 0, 69, 124, 68, 108, 3, 124, 120, 68, 0, 67, 96, 69, 120, 70, 12, 69, 120, 57, 96, 0, 0, 112, 124, 27, 28, 124, 112, 0, 68, 0, 69, 124, 69, 76, 5, 124, 120, 48, 68, 0, 69, 124, 68, 12, 10, 28, 120, 112,
    68, 0, 20, 48, 120, 124, 108, 69, 76, 67, 0, 84, 0, 67, 96, 69, 120, 70, 12, 69, 120, 67, 96, 68, 0, 69, 124, 71, 76, 66, 12, 86, 0, 69, 124, 68, 12, 10, 28, 120, 112, 70, 0, 69, 124, 70, 108, 66, 12, 70, 0, 69, 124, 98, 0, 68, 7, 68, 6, 0, 7, 3, 70, 0, 68, 3, 70, 6, 68, 3, 12, 0, 4, 7, 3, 70, 1, 12, 3, 7, 4, 0, 68, 7, 28, 0, 1, 7, 6, 4, 68, 0, 68, 7, 68, 6, 4, 7, 3, 1,
    68, 0, 66, 2, 70, 6, 4, 7, 3, 1, 86, 0, 68, 3, 70, 6, 68, 3, 70, 0, 68, 7, 94, 0, 68, 7, 68, 6, 4, 7, 3, 1, 70, 0, 68, 7, 72, 6, 70, 0, 68, 7, 72, 6, 126, 98, 0, 247
]);

function decode(data) {
  if (data.length < 3 || data[0] != 0xf0 || data[1] != 0x7d) {
    console.log("foreign sysex?")
    return;
  }

  if (data.length >= 5 && data[2] == 0x02 && data[3] == 0x40) {
    console.log("found OLED!")

    if (data[4] != 1) {
      console.log("DO NOT DO THAT")
      return;
    }

    let packed = data.subarray(6,data.length-1)
    console.log("packed size "+ packed.length);

    let unpacked = unpack(packed)
    console.log("unpacked size "+ unpacked.length);

    let ctx = $("myCanvas").getContext("2d")

    let px_height = 5;
    let px_width = 5;
    let indist = 1;

    let blk_width = 128;
    ctx.fillStyle = "#222222";
    ctx.fillRect(0,0,px_width*128,px_height*48)

    ctx.fillStyle = "#dddddd";
    for (let blk = 0; blk < 6; blk++) {
      for (let rstride = 0; rstride < 8; rstride++) {
        let mask = 1 << (rstride);
        for (let j = 0; j < blk_width; j++) {
          if ((blk*blk_width+j) > unpacked.lenght) {
            break;
          }
          let idata = (unpacked[blk*blk_width+j] & mask);

          let y = blk*8 + rstride;

          if (idata > 0) {
            ctx.fillRect(j*px_width,y*px_height, px_width-indist, px_height-indist);
          }

        }
      }
    }
    return;
  }
}

function unpack(src) {
  let src_len = src.length
  let dst = new Uint8Array(2048); // TODO: dynamic size!
  let dst_size = 2048;

  let d = 0;
  let s = 0;

  while (s+1 < src_len) {
    let first = src[s++];
    if (first < 64) {
      let size = 0; let off = 0;
      if (first < 4) { size = 2; off = 0; }
      else if (first < 12) { size = 3; off = 4; }
      else if (first < 28) { size = 4; off = 12; }
      else if (first < 60) { size = 5; off = 28; }
      else {
        return -7;
      }

      if (size > src_len-s) {
        // printf("s: %d, d: %d, first: %d\n", s, d, first);
        return -1;
      }
      if (size > dst_size-d) return -11;
      let highbits = first-off;
      for (let j = 0; j < size; j++) {
        dst[d+j] = src[s+j] & 0x7f;
        if (highbits & (1<<j)) {
          dst[d+j] |= 0x80;
        }
      }

      d += size;
      s += size;
    } else {
      // first = 64 + (runlen<<1) + highbit
      first = first-64;
      let high = (first&1);
      let runlen = first >> 1;
      if (runlen == 31) {
        runlen = 31 + src[s++];
        if (s == src_len) return -3;
      }
      let byteval = src[s++] + 128*high;
      if (runlen > dst_size-d) return -12;
      dst.fill(byteval, d, d+runlen);
      d += runlen;
    }
  }
  return dst.subarray(0,d);
}
