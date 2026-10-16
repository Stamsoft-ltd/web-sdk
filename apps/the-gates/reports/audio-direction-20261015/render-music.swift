// Offline approval sketches. Uses the local macOS GM soundbank; not production-cleared assets.
import AVFoundation
import Foundation
let rate = 44100.0
struct Note { let track:Int; let at:Double; let length:Double; let pitch:UInt8; let velocity:UInt8 }
struct Event { let frame:Int64; let track:Int; let pitch:UInt8; let velocity:UInt8 }
let bank = URL(fileURLWithPath:"/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
// Marimba, pizzicato strings, harp, French horn, trumpet, timpani, celesta, choir.
let programs:[UInt8] = [12,45,46,60,56,47,8,52]
let levels:[Float] = [0.70,0.68,0.5,0.48,0.30,0.50,0.35,0.16]
func render(_ name:String,_ duration:Double,_ notes:[Note]) throws {
 let engine = AVAudioEngine()
 var samplers:[AVAudioUnitSampler] = []
 let format = AVAudioFormat(standardFormatWithSampleRate:rate,channels:2)!
 for i in programs.indices {
  let s = AVAudioUnitSampler(); engine.attach(s)
  try s.loadSoundBankInstrument(at:bank,program:programs[i],bankMSB:121,bankLSB:0)
  s.volume = levels[i]; engine.connect(s,to:engine.mainMixerNode,format:format); samplers.append(s)
 }
 let reverb = AVAudioUnitReverb(); reverb.loadFactoryPreset(.mediumHall); reverb.wetDryMix = 13
 engine.attach(reverb); engine.connect(engine.mainMixerNode,to:reverb,format:format)
 engine.connect(reverb,to:engine.outputNode,format:format)
 try engine.enableManualRenderingMode(.offline,format:format,maximumFrameCount:1024)
 let output = URL(fileURLWithPath:CommandLine.arguments[1]).appendingPathComponent(name+"-raw.wav")
 let file = try AVAudioFile(forWriting:output,settings:format.settings)
 let buffer = AVAudioPCMBuffer(pcmFormat:format,frameCapacity:1024)!
 var events:[Event] = []
 for n in notes {
  events.append(Event(frame:Int64(n.at*rate),track:n.track,pitch:n.pitch,velocity:n.velocity))
  events.append(Event(frame:Int64((n.at+n.length)*rate),track:n.track,pitch:n.pitch,velocity:0))
 }
 events.sort { $0.frame == $1.frame ? $0.velocity < $1.velocity : $0.frame < $1.frame }
 try engine.start(); var i = 0; let end = Int64(duration*rate)
 while engine.manualRenderingSampleTime < end {
  let current = engine.manualRenderingSampleTime
  while i < events.count && events[i].frame <= current {
   let e = events[i]
   if e.velocity == 0 {samplers[e.track].stopNote(e.pitch,onChannel:0)}
   else {samplers[e.track].startNote(e.pitch,withVelocity:e.velocity,onChannel:0)}
   i += 1
  }
  let next = i < events.count ? min(end,events[i].frame) : end
  let count = AVAudioFrameCount(min(1024,max(1,next-current)))
  let status = try engine.renderOffline(count,to:buffer)
  if status == .success {try file.write(from:buffer)}
  else if status == .error {throw NSError(domain:"render",code:1)}
 }
 engine.stop(); print(name)
}
func note(_ t:Int,_ at:Double,_ len:Double,_ p:Int,_ v:Int)->Note { Note(track:t,at:at,length:len,pitch:UInt8(p),velocity:UInt8(v)) }

// Eight-bar cyclic scores. Three rendered passes warm the sampler/reverb;
// finish-music.py extracts the middle pass without fades or added silence.
func music(_ bonus:Bool) throws {
 let bpm=bonus ? 120.0:96.0, beat=60.0/bpm, cycle=32.0*beat
 var score:[Note]=[]
 let roots=[50,50,46,46,53,53,48,48] // Dm, Bb, F, C; two bars each.
 let thirds=[53,53,50,50,57,57,52,52]
 let fifths=[57,57,53,53,60,60,55,55]
 let melodies=[[74,77,81,77],[76,74,69,72],[74,77,82,81],[77,74,72,69],[77,81,84,81],[79,77,72,69],[76,79,84,79],[76,72,69,72]]
 for pass in 0..<3 {
  let origin=Double(pass)*cycle
  for bar in 0..<8 {
   let start=origin+Double(bar*4)*beat
   let r=roots[bar],third=thirds[bar],fifth=fifths[bar]
   // Alternating warm pizzicato bass, never a constant click track.
   for b in 0..<4 {
    let pitch=b%2==0 ? r-12:fifth-12
    score.append(note(1,start+Double(b)*beat,beat*0.45,pitch,bonus ? 52:42))
   }
   let arp=[r+12,third+12,fifth+12,third+24,fifth+12,third+12,r+24,fifth+12]
   for (i,pitch) in arp.enumerated() {
    score.append(note(2,start+Double(i)*beat/2,beat*0.42,pitch,bonus ? 38+(i%3)*4:31+(i%3)*3))
   }
   // Short phrases leave breathing room between motives.
   if bonus || bar%2==0 {
    for (i,pitch) in melodies[bar].enumerated() {
     score.append(note(bonus ? 3:6,start+Double(i)*beat,beat*(i==3 ? 0.65:0.48),pitch,bonus ? 57:37))
    }
   } else {
    score.append(note(0,start+beat,beat*0.32,third+24,38))
    score.append(note(0,start+beat*2.5,beat*0.32,fifth+24,35))
   }
   if bonus {
    // Warm low brass and restrained timpani, not a nonstop win fanfare.
    for pitch in [r,third,fifth] {score.append(note(3,start,beat*1.4,pitch,36))}
    score.append(note(5,start,beat*0.45,r-12,45))
    score.append(note(5,start+beat*2,beat*0.3,fifth-12,35))
    if bar==3 || bar==7 {
     score.append(note(4,start+beat*3,beat*0.35,melodies[bar][3]-12,48))
    }
   }
  }
 }
 try render(bonus ? "bonus-music":"base-music",cycle*3,score)
}
try music(false)
try music(true)
