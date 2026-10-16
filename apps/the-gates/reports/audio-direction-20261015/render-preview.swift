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
let pitches = [60,62,64,67,69,72]
func land(_ reel:Int,_ at:Double)->[Note] {
 let p=pitches[reel]
 return [note(0,at,0.09,p,62),note(1,at+0.006,0.08,p-12,50)]
}
for r in 0..<6 { try render("reel-land-\(r+1)",0.7,land(r,0.02)) }
try render("01-reel-landings",2.1,(0..<6).flatMap {land($0,0.08+Double($0)*0.14)})
var cascade:[Note] = []
for (i,p) in [72,76,79,84].enumerated() {let t=0.04+Double(i)*0.085; cascade += [note(2,t,0.2,p,65),note(6,t,0.12,p,40)]}
cascade += [note(1,0.04,0.14,48,48),note(1,0.21,0.14,55,44)]
try render("02-cascade",1.6,cascade)
var gate:[Note] = [note(5,0.04,0.22,36,88),note(5,0.14,0.14,43,56)]
for (i,p) in [48,55,60,64,67,72,76,79,84].enumerated() {gate.append(note(2,0.34+Double(i)*0.065,0.25,p,48+i*2))}
for p in [48,55,60] {gate.append(note(7,0.42,0.7,p,44))}
for p in [60,64,67] {gate.append(note(3,0.9,0.30,p,62))}
gate.append(note(6,0.92,0.25,84,58))
try render("03-gate-portal",2.5,gate)
var fanfare:[Note] = []
for (at,len,p,v) in [(0.05,0.14,67,70),(0.25,0.14,67,72),(0.45,0.18,72,80),(0.72,0.25,76,82),(1.06,0.66,79,86)] {
 fanfare += [note(4,at,len,p,v),note(3,at,len,p-12,v-8)]
}
for p in [48,55,60,64] {fanfare.append(note(3,1.06,0.68,p,65))}
for (i,p) in [72,76,79,84,88].enumerated() {fanfare.append(note(2,1.06+Double(i)*0.06,0.3,p,55))}
fanfare += [note(5,0.05,0.16,36,68),note(5,0.72,0.16,43,64),note(5,1.06,0.35,36,85)]
try render("04-win-fanfare",3.2,fanfare)
// Expanded approval pack: short, non-looping event cues.
try render("05-ui-click",0.45,[note(0,0.01,0.045,79,42),note(1,0.015,0.035,67,30)])
try render("06-spin-start",0.7,[note(1,0.01,0.08,48,50),note(1,0.07,0.08,55,55),note(0,0.13,0.09,60,48)])
var wisp:[Note] = []
for (i,p) in [72,76,79,84].enumerated() {wisp.append(note(2,0.015+Double(i)*0.055,0.08,p,35+i*4))}
wisp.append(note(6,0.25,0.16,91,54))
try render("07-wisp-arrival",0.9,wisp)
try render("08-multiplier-add",1.1,[note(3,0.015,0.14,67,60),note(6,0.025,0.12,84,50),note(6,0.14,0.18,88,54)])
try render("09-multiplier-boost",1.4,[note(3,0.015,0.13,67,65),note(3,0.18,0.25,72,74),note(6,0.02,0.15,84,50),note(6,0.18,0.22,91,60),note(5,0.18,0.15,48,55)])
try render("10-wild-reward",1.2,[note(0,0.01,0.07,48,56),note(0,0.10,0.07,60,60),note(0,0.19,0.12,72,65),note(3,0.23,0.2,67,60),note(6,0.24,0.2,88,58)])
try render("11-extra-spin",1.0,[note(1,0.01,0.08,67,58),note(2,0.09,0.16,79,58),note(6,0.18,0.16,84,58)])
try render("12-retrigger",1.8,[note(4,0.015,0.13,67,70),note(4,0.20,0.13,72,72),note(4,0.39,0.32,79,75),note(3,0.39,0.32,60,62),note(6,0.40,0.25,91,55),note(5,0.39,0.25,36,70)])
try render("13-bonus-entry",3.5,gate + fanfare.map {note($0.track,$0.at+0.7,$0.length,Int($0.pitch),Int($0.velocity))})
try render("14-bonus-summary",2.8,[note(3,0.01,0.28,67,66),note(3,0.35,0.28,64,62),note(3,0.69,0.65,60,68),note(3,0.69,0.65,48,58),note(2,0.7,0.3,72,48),note(2,0.8,0.3,76,48),note(2,0.9,0.3,79,46)])
try render("15-gate-close",0.9,[note(5,0.015,0.24,36,87),note(5,0.10,0.14,43,54),note(1,0.02,0.08,36,58)])
try render("16-portal-retract",1.3,[84,79,76,72,67,60,48].enumerated().map {note(2,0.02+Double($0.offset)*0.065,0.18,$0.element,52-$0.offset*3)})
try render("17-key-land",1.0,[note(0,0.01,0.08,72,62),note(6,0.01,0.2,84,60),note(6,0.12,0.25,91,44)])
for (name,offset,velocity,extra) in [("18-win-sweet",-5,-14,0.0),("19-win-epic",0,0,0.2),("20-win-mythic",2,3,0.6),("21-win-legendary",5,4,1.0)] {
 var notes = fanfare.map {note($0.track,$0.at,$0.length+($0.at>1 ? extra:0),Int($0.pitch)+($0.track == 5 ? 0:offset),min(110,Int($0.velocity)+velocity))}
 if extra>0.4 {
  for (i,p) in [72,76,79,84,88,91].enumerated() {notes.append(note(2,1.65+Double(i)*0.07,0.25,p,55))}
 }
 try render(name,3.2+extra,notes)
}
