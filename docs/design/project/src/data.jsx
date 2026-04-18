// Mock data — realistic reminder assistant content.
// "Now" is anchored to 2:47 PM for consistent previews.

const NOW_LABEL = '2:47 PM';
const TODAY_LABEL = 'Fri, Apr 18';

const seedTasks = [
  { id: 't1', title: 'Call Mom — she left a voicemail',    time:'1:30 PM', when:-77,  status:'overdue', tag:'Personal', notes:'Mentioned something about the trip.' },
  { id: 't2', title: 'Submit Q2 tax worksheet to Anna',     time:'2:00 PM', when:-47,  status:'overdue', tag:'Work',     notes:'Spreadsheet is in the Finance drive.' },
  { id: 't2b',title: 'Reply to landlord about lease renewal',time:'2:30 PM', when:-17,  status:'overdue', tag:'Home',     notes:'They need an answer by Friday.' },
  { id: 't3', title: 'Pick up prescription at Walgreens',   time:'3:15 PM', when:28,   status:'pending', tag:'Errand' },
  { id: 't4', title: 'Stand-up with the platform team',     time:'4:00 PM', when:73,   status:'pending', tag:'Work',     recur:'Weekdays' },
  { id: 't5', title: 'Water the fiddle-leaf fig',           time:'5:30 PM', when:163,  status:'pending', tag:'Home',     recur:'Every 3 days' },
  { id: 't6', title: 'Pay rent before midnight',            time:'11:59 PM',when:552,  status:'pending', tag:'Finance',  flag:true },
  { id: 't7', title: 'Morning run (5K)',                    time:'7:00 AM', when:-467, status:'done',    tag:'Health',   recur:'Daily' },
  { id: 't8', title: 'Coffee with Dev',                     time:'9:30 AM', when:-317, status:'done',    tag:'Personal' },
];

const upcomingDays = [
  {
    day:'Tomorrow', date:'Sat, Apr 19',
    items:[
      { time:'9:00 AM',  title:'Team retro prep',           tag:'Work' },
      { time:'12:30 PM', title:'Lunch w/ Priya',            tag:'Personal' },
      { time:'6:00 PM',  title:'Pottery class',             tag:'Learning', recur:'Weekly' },
    ]
  },
  {
    day:'Sunday', date:'Apr 20',
    items:[
      { time:'8:00 AM',  title:'Long run — 10K',            tag:'Health' },
      { time:'4:00 PM',  title:'Call dad',                  tag:'Personal' },
    ]
  },
  {
    day:'Monday', date:'Apr 21',
    items:[
      { time:'9:00 AM',  title:'Kickoff — onboarding redesign', tag:'Work' },
      { time:'2:00 PM',  title:'Dentist — 6-month cleaning',    tag:'Health' },
      { time:'7:30 PM',  title:'Book club — Kitchen Confidential', tag:'Personal' },
    ]
  },
];

const timelineToday = [
  { time:'1:30',  ampm:'PM', title:'Call Mom — she left a voicemail', tag:'Personal', state:'overdue' },
  { time:'2:00',  ampm:'PM', title:'Submit Q2 tax worksheet to Anna', tag:'Work',     state:'overdue' },
  { time:'2:47',  ampm:'PM', title:'— now',                           state:'now' },
  { time:'3:15',  ampm:'PM', title:'Pick up prescription at Walgreens', tag:'Errand', state:'pending' },
  { time:'4:00',  ampm:'PM', title:'Stand-up with the platform team',   tag:'Work',   state:'pending', recur:'Weekdays' },
  { time:'5:30',  ampm:'PM', title:'Water the fiddle-leaf fig',         tag:'Home',   state:'pending' },
  { time:'11:59', ampm:'PM', title:'Pay rent before midnight',          tag:'Finance',state:'pending', flag:true },
];

window.Data = { seedTasks, upcomingDays, timelineToday, NOW_LABEL, TODAY_LABEL };
