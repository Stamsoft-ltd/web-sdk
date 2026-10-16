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


// Distinct scores, not pitch/speed variants. Existing bonus-music remains Normal.
func bonusVariant(_ hidden:Bool) throws {
 let bpm=hidden ? 100.0:128.0,beat=60.0/bpm,cycle=32.0*beat
 let roots=hidden ? [50,50,55,55,46,46,45,45]:[50,50,48,48,46,46,45,45]
 let thirds=hidden ? [53,53,58,58,50,50,49,49]:[53,53,52,52,50,50,49,49]
 let fifths=hidden ? [57,57,62,62,53,53,52,52]:[57,57,55,55,53,53,52,52]
 let superMelody=[[74,81,77,81],[84,81,77,74],[76,79,84,79],[76,72,79,76],[77,82,86,82],[81,77,74,77],[76,73,81,76],[73,69,73,81]]
 let hiddenMelody=[[74,77,81],[86,84,81],[79,82,86],[89,86,82],[82,86,89],[86,84,82],[81,85,88],[85,81,73]]
 var score:[Note]=[]
 for pass in 0..<3 {
  for bar in 0..<8 {
   let start=Double(pass)*cycle+Double(bar*4)*beat
   let r=roots[bar],third=thirds[bar],fifth=fifths[bar]
   if hidden {
    // Broad majestic horn phrases, gentle choir beds and glinting answers.
    for pitch in [r,third,fifth] {score.append(note(7,start,beat*3.8,pitch,42))}
    for (i,pitch) in hiddenMelody[bar].enumerated() {
     let time=start+[0.0,1.5,3.0][i]*beat
     score.append(note(3,time,beat*(i==1 ? 1.2:0.9),pitch-12,62))
     if bar%2==1 {score.append(note(4,time+beat*0.15,beat*0.65,pitch,39))}
    }
    for (i,pitch) in [r+24,third+24,fifth+24,third+36].enumerated() {
     score.append(note(2,start+Double(i)*beat,beat*0.85,pitch,42))
     if i%2==1 {score.append(note(6,start+(Double(i)+0.5)*beat,beat*0.25,pitch+12,30))}
    }
    score.append(note(5,start,beat*0.65,r-12,53))
    score.append(note(1,start+beat*2,beat*0.6,fifth-12,43))
   } else {
    // Bouncy syncopated strings; brass call/response over moving bass.
    for (i,step) in [0.0,0.75,1.5,2.0,2.75,3.5].enumerated() {
     score.append(note(1,start+step*beat,beat*0.27,i%2==0 ? r:fifth,54+(i%2)*4))
    }
    for (i,pitch) in superMelody[bar].enumerated() {
     let time=start+Double(i)*beat
     score.append(note(bar%2==0 ? 3:4,time,beat*0.48,pitch-(bar%2==0 ? 12:0),bar%2==0 ? 65:48))
    }
    for (i,pitch) in [r+12,third+12,fifth+12,r+24,third+24,fifth+12,third+12,r+24].enumerated() {
     score.append(note(2,start+Double(i)*beat/2,beat*0.32,pitch,37+i%3*3))
    }
    score.append(note(5,start,beat*0.35,r-12,48))
    score.append(note(5,start+beat*2.5,beat*0.25,fifth-12,39))
    if bar==3 || bar==7 {score.append(note(6,start+beat*3.5,beat*0.2,fifth+36,45))}
   }
  }
 }
 try render(hidden ? "hidden-music":"super-music",cycle*3,score)
}
try bonusVariant(false)
try bonusVariant(true)
