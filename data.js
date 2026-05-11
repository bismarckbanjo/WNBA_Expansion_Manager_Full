/*
  Prototype data notes:
  - Team/player names reflect a 2026 WNBA roster scaffold for a front-office game prototype.
  - Salaries, contract years, protection statuses, trade preferences and hidden numeric ratings are game abstractions.
  - No official WNBA ratings or salary data is represented here.
*/
window.GAME_DATA = {
  cap: 7000000,
  rosterMin: 11,
  rosterMax: 12,
  expansionPickLimit: 12,
  expansionCities: [
    { city: 'Philadelphia', nickname: 'Foundry', arena: 'Independence Center', market: 91, pressure: 72 },
    { city: 'Nashville', nickname: 'Sound', arena: 'Cumberland Arena', market: 78, pressure: 58 },
    { city: 'Miami', nickname: 'Sol', arena: 'Biscayne Forum', market: 88, pressure: 68 },
    { city: 'Denver', nickname: 'Summit', arena: 'Mile High Pavilion', market: 82, pressure: 62 },
    { city: 'Austin', nickname: 'Comets', arena: 'Lone Star Fieldhouse', market: 84, pressure: 64 },
    { city: 'Charlotte', nickname: 'Flight', arena: 'Queen City Arena', market: 76, pressure: 55 },
    { city: 'San Diego', nickname: 'Wave', arena: 'Harbor Dome', market: 80, pressure: 57 },
    { city: 'St. Louis', nickname: 'Archers', arena: 'Gateway Center', market: 70, pressure: 51 }
  ],
  draftProspects: [
    p('Dani Carnegie','G','UCLA',570000,4,'Lottery engine guard with star equity; bends defenses with pace but must prove she can organize late-clock possessions.','Three-level scoring flashes, downhill burst, transition creation','Screen navigation, turnover spikes, defensive gambling',false,88,74,84,66,50,91,82,94,'creator'),
    p('Aaliyah Chavez','G','Oklahoma',545000,4,'Dynamic freshman-scale shot maker with instant-offense gravity; the swing skill is shot selection against length.','Deep range, handle, foul pressure','Size matchups, defensive consistency',false,87,86,80,58,44,86,79,92,'shooter'),
    p('Juju Watkins','G/F','USC',650000,4,'Franchise-wing profile who can carry usage and survive playoff physicality; expensive prospect asset in any trade model.','Rim pressure, scoring volume, two-way tools','Can force contested looks, needs veteran spacing',true,94,79,78,81,68,89,86,98,'star'),
    p('MiLaysia Fulwiley','G','South Carolina',520000,3,'Electric guard who changes game tempo immediately; best with a steady veteran partner.','First step, creativity, transition chaos','Half-court patience, point-of-attack discipline',false,82,74,77,62,48,94,73,89,'spark'),
    p('Ta’Niya Latson','G','Florida State',530000,3,'High-volume bucket getter with aggressive scoring instincts; needs a defensive infrastructure behind her.','Isolation scoring, foul drawing, pull-up game','Size, off-ball defensive lapses',false,85,77,71,55,43,84,75,88,'scorer'),
    p('Lauren Betts','C','UCLA',610000,4,'Interior anchor with rare size and touch; warps shot charts but roster must protect her in space.','Paint efficiency, rim deterrence, rebounding','Switch defense, tempo versatility',false,81,48,60,86,91,62,84,93,'anchor'),
    p('Kiki Iriafen','F','Washington Mystics',760000,3,'Pro-ready forward who gives structure to a young roster; already valued like a core starter.','Face-up scoring, glass, physicality','Passing reads under doubles, foul discipline',true,83,64,63,79,84,75,80,90,'forward'),
    p('Paige Bueckers','G','Dallas Wings',1150000,4,'Primary decision-maker with elite feel; every roster construction plan improves when she is on the floor.','Advantage creation, shooting touch, processing','Durability management, defensive workload',true,91,88,94,72,56,77,96,97,'engine')
  ],
  teams: [
    team('ATL','Atlanta Dream','#c8102e','#00a9e0','contender',[
      p('Allisha Gray','G','ATL',990000,2,'Two-way guard who raises the floor without needing every action called for her.','Shot versatility, defense, late-clock poise','Can be stretched as full-time lead creator',true,86,82,77,83,55,79,86,86,'twoWay'),
      p('Rhyne Howard','G/F','ATL',1180000,3,'Big wing scorer with star gravity and enough defensive tools to headline a playoff roster.','Pull-up threes, size, transition scoring','Shot diet can run cold',true,90,84,75,77,64,82,83,91,'star'),
      p('Brittney Griner','C','ATL',900000,1,'Veteran interior finisher who changes opponent shot selection around the rim.','Post scoring, rim deterrence, experience','Spacing, lateral matchups',true,82,42,58,80,78,49,83,76,'anchor'),
      p('Brionna Jones','C','ATL',930000,2,'Reliable paint hub with soft touch and playoff toughness.','Screening, post touch, rebounding','Vertical spacing, transition speed',true,80,45,64,78,83,58,88,80,'anchor'),
      p('Jordin Canada','G','ATL',620000,1,'Pressure guard who organizes the floor and makes ball handlers uncomfortable.','Point-of-attack defense, passing, pace','Shooting volume, size at switches',false,70,58,82,86,48,84,85,75,'defense'),
      p('Nia Coffey','F','ATL',510000,1,'Combo forward who fits winning lineups as a connective defender.','Switchability, corner spacing, activity','Self-created offense',false,65,65,59,78,67,75,78,70,'connector'),
      p('Maya Caldwell','G','ATL',330000,1,'Depth guard who competes and can absorb regular-season minutes.','Energy, spot minutes, defensive effort','Creation ceiling',false,58,58,55,62,42,70,66,62,'depth')
    ]),
    team('CHI','Chicago Sky','#fdb927','#418fde','retooling',[
      p('Angel Reese','F','CHI',980000,3,'Elite possession winner whose rebounding gives any expansion team an immediate identity.','Offensive glass, motor, physical defense','Half-court scoring polish, spacing',true,76,36,60,82,96,80,78,91,'rebounder'),
      p('Kamilla Cardoso','C','CHI',860000,3,'Massive interior presence who protects the paint and finishes high-value touches.','Rim protection, size, paint finishing','Free throws, defending in space',true,75,30,52,84,89,54,73,88,'anchor'),
      p('Ariel Atkins','G','CHI',850000,2,'Veteran two-way guard with playoff credibility and low-maintenance offense.','On-ball defense, shooting, professionalism','Elite creation burden',true,78,78,70,84,49,75,86,80,'twoWay'),
      p('Hailey Van Lith','G','CHI',500000,3,'Competitive guard with name value and microwave scoring appeal.','Confidence, pull-up scoring, marketing pop','Size, efficiency swings',false,72,68,65,58,40,78,68,79,'spark'),
      p('Elizabeth Williams','C','CHI',470000,1,'Veteran backup big who stabilizes bench defense.','Rim positioning, screening, leadership','Offensive spacing',false,61,25,52,74,76,48,82,62,'veteran'),
      p('Michaela Onyenwere','F','CHI',430000,1,'Athletic forward who can fill minutes at either forward slot.','Straight-line drives, athleticism, rebounding','Decision speed, consistency',false,63,61,54,66,65,78,65,69,'wing'),
      p('Rachel Banham','G','CHI',360000,1,'Bench shooter who punishes lazy rotations.','Movement shooting, experience','Defense, rim pressure',false,59,76,58,48,35,54,78,58,'shooter')
    ]),
    team('CON','Connecticut Sun','#f05023','#0a2240','rebuilding',[
      p('Marina Mabrey','G','CON',920000,2,'Combustible shot maker who can carry bench or starter offense.','Deep shooting, confidence, secondary creation','Defensive matchups, shot discipline',true,80,84,69,60,45,70,75,78,'shooter'),
      p('Leïla Lacan','G','CON',560000,3,'Developmental guard with defensive bite and upside as a two-way connector.','Size at guard, instincts, transition passing','Polish, shooting consistency',true,64,61,70,74,50,77,72,84,'prospect'),
      p('Tina Charles','C','CON',700000,1,'Decorated interior scorer who can still punish bench units.','Post scoring, rebounding, footwork','Pace, defensive range',false,77,40,58,62,80,45,88,61,'veteran'),
      p('Olivia Nelson-Ododa','C','CON',420000,2,'Mobile big with passing flashes and defensive utility.','Mobility, touch passes, length','Strength, scoring assertiveness',false,60,34,60,70,74,67,70,72,'connector'),
      p('Jacy Sheldon','G','CON',460000,2,'Energetic guard who pressures the rim and defends with real edge.','Speed, defense, rim pressure','Jumper consistency, playmaking volume',false,65,62,60,73,43,85,67,76,'spark'),
      p('Aneesah Morrow','F','CON',540000,3,'Relentless frontcourt producer with double-double instincts.','Rebounding, motor, paint scoring','Size translation, spacing',false,72,31,50,70,90,76,64,83,'rebounder'),
      p('Saniya Rivers','G/F','CON',500000,3,'Long wing defender with transition pop and untapped on-ball upside.','Length, defensive playmaking, athleticism','Shooting, half-court role clarity',false,63,50,61,79,62,86,65,82,'defense')
    ]),
    team('DAL','Dallas Wings','#002b5c','#c4d600','rebuilding',[
      p('Paige Bueckers','G','DAL',1150000,4,'Primary decision-maker with elite feel; every roster construction plan improves when she is on the floor.','Advantage creation, shooting touch, processing','Durability management, defensive workload',true,91,88,94,72,56,77,96,97,'engine'),
      p('Arike Ogunbowale','G','DAL',1180000,2,'Fearless closer who bends defenses with audacious shot-making.','Late-game scoring, handle, range','Shot selection, defensive focus',true,92,86,72,61,43,82,78,86,'scorer'),
      p('Maddy Siegrist','F','DAL',640000,2,'Efficient forward who thrives off smart cuts and clean finishing windows.','Off-ball scoring, touch, IQ','High-end athleticism, creation volume',true,72,68,55,66,70,62,82,78,'connector'),
      p('Teaira McCowan','C','DAL',760000,1,'Traditional center who changes rebounding math immediately.','Size, offensive boards, paint finishing','Spacing, defending tempo',false,68,22,45,66,90,39,70,66,'rebounder'),
      p('Aziaha James','G','DAL',480000,3,'Shot-hunting guard with real bench scoring juice.','Pull-up scoring, confidence, quick release','Playmaking, defensive reads',false,69,72,58,54,41,78,64,80,'spark'),
      p('Myisha Hines-Allen','F','DAL',550000,1,'Physical veteran forward who can defend, screen, and steady young groups.','Strength, passing, toughness','Shooting consistency',false,64,53,63,70,76,63,78,65,'veteran'),
      p('Lou Lopez Sénéchal','G/F','DAL',350000,1,'Shooting wing who needs the right defensive coverages to stay playable.','Catch-and-shoot, size on wing','Defense, creation',false,58,72,50,52,44,57,65,64,'shooter')
    ]),
    team('GS','Golden State Valkyries','#5d3fd3','#f5d76e','ascending',[
      p('Kayla Thornton','F','GS',760000,2,'Culture-setting forward who guards stars and survives messy possessions.','Defense, toughness, rebounding','Self-created offense',true,67,63,58,84,73,70,82,71,'defense'),
      p('Veronica Burton','G','GS',700000,2,'Point guard who gives shape to possessions and irritates opposing creators.','Defense, table-setting, low mistakes','Scoring punch',true,66,62,80,86,46,78,86,74,'engine'),
      p('Tiffany Hayes','G','GS',650000,1,'Veteran guard with downhill aggression and playoff scars.','Rim pressure, foul pressure, experience','Age curve, three-point variance',false,76,65,65,66,46,77,79,61,'veteran'),
      p('Cecilia Zandalasini','F','GS',470000,1,'Skilled international wing with connective passing.','Shooting feel, size, quick decisions','WNBA physicality, defensive speed',false,63,70,62,58,58,55,76,66,'connector'),
      p('Temi Fagbenle','C','GS',440000,1,'Mobile big who runs the floor and adds defensive activity.','Mobility, rim runs, experience','Shooting, availability',false,62,24,48,70,72,70,71,62,'big'),
      p('Carla Leite','G','GS',460000,3,'Young guard with craft and long-term lead-handler intrigue.','Handle, pace changes, creativity','Strength, defensive translation',false,62,61,68,57,39,77,65,82,'prospect'),
      p('Monique Billings','F','GS',420000,1,'Energy forward who rebounds and keeps possessions alive.','Motor, glass, hustle defense','Spacing, shot creation',false,60,29,48,67,82,72,68,61,'rebounder')
    ]),
    team('IND','Indiana Fever','#e03a3e','#002d62','contender',[
      p('Caitlin Clark','G','IND',1320000,4,'Generational offensive engine; her passing range and shooting gravity rewrite every possession.','Deep range, passing vision, tempo control','Physical defensive matchups, turnover risk under traps',true,93,97,96,66,50,81,95,99,'star'),
      p('Aliyah Boston','C','IND',1080000,3,'Franchise big with touch, screening feel, and defensive structure.','Post efficiency, screening, defensive IQ','Can be pulled from rim by five-out looks',true,84,42,72,84,86,62,89,94,'anchor'),
      p('Kelsey Mitchell','G','IND',1020000,2,'Elite movement scorer who makes defensive mistakes expensive.','Off-ball shooting, speed, shot making','Size, playmaking burden',true,88,89,67,58,42,88,80,82,'scorer'),
      p('Lexie Hull','G/F','IND',610000,2,'Glue wing who defends, runs, and does not need touches to matter.','Perimeter defense, cutting, hustle','Self-creation, elite shooting volume',true,65,66,58,83,56,76,82,75,'connector'),
      p('Natasha Howard','F','IND',790000,1,'Veteran frontcourt defender with championship know-how.','Switch defense, rim support, toughness','Efficiency swings, age curve',false,73,55,58,80,78,74,84,66,'veteran'),
      p('Sophie Cunningham','G/F','IND',560000,1,'Combative shooter who adds spacing and edge.','Catch shooting, competitiveness, spacing','Defensive discipline, shot creation',false,66,76,55,61,47,64,76,63,'shooter'),
      p('Damiris Dantas','F/C','IND',410000,1,'Stretch frontcourt veteran who can open lanes for drivers.','Pick-and-pop shooting, size, experience','Foot speed, defensive range',false,61,70,54,56,62,43,78,55,'stretch')
    ]),
    team('LV','Las Vegas Aces','#000000','#c5b783','dynasty',[
      p('A’ja Wilson','F/C','LV',1400000,3,'The league standard: elite scorer, defender, and possession stabilizer.','MVP scoring, rim protection, foul pressure','None meaningful; heavy usage fatigue only',true,98,67,78,96,92,86,97,99,'star'),
      p('Jackie Young','G','LV',1220000,3,'Big guard who can defend, create, and finish without wasting possessions.','Two-way versatility, strength, efficiency','Can defer too much next to stars',true,88,84,82,86,65,82,90,91,'twoWay'),
      p('Chelsea Gray','G','LV',980000,1,'Veteran maestro whose passing turns hard shots into rhythm shots.','Playmaking, clutch creation, IQ','Age curve, regular-season burst',true,78,77,94,65,48,58,98,70,'engine'),
      p('Jewell Loyd','G','LV',1180000,2,'Elite scorer with championship experience and shot-making ego.','Three-level scoring, big-game confidence','Efficiency variance, defensive energy',true,90,85,72,62,48,78,82,83,'scorer'),
      p('Kiah Stokes','C','LV',430000,1,'Defense-first center who knows exactly what her role is.','Rim positioning, screening, rebounding','Scoring, spacing',false,48,24,42,78,74,41,80,52,'defense'),
      p('Dana Evans','G','LV',450000,1,'Small guard with bench scoring and pace.','Speed, pull-up range, pressure','Size, finishing over length',false,66,70,63,52,36,84,67,66,'spark'),
      p('Megan Gustafson','F/C','LV',390000,1,'Efficient reserve big with touch and rebounding instincts.','Touch, offensive boards, effort','Defense in space',false,60,44,44,54,72,49,70,58,'big')
    ]),
    team('LA','Los Angeles Sparks','#552583','#fdb927','ascending',[
      p('Cameron Brink','F/C','LA',930000,3,'High-impact defensive prospect whose ceiling changes a franchise timeline.','Rim protection, mobility, shooting flashes','Foul discipline, strength through contact',true,76,62,60,90,80,76,78,93,'anchor'),
      p('Rickea Jackson','F','LA',880000,3,'Smooth scoring forward with mismatch tools and future All-Star pathways.','Midrange scoring, size, touch','Defensive consistency, passing reads',true,82,69,59,67,66,75,73,90,'scorer'),
      p('Dearica Hamby','F','LA',920000,2,'Relentless veteran forward who stacks production without needing plays.','Rebounding, transition, motor','Shooting gravity, age curve',true,78,55,63,74,88,76,85,76,'rebounder'),
      p('Kelsey Plum','G','LA',1170000,2,'High-octane guard with title experience and instant spacing.','Pull-up threes, speed, scoring confidence','Size, defensive matchups',true,88,90,76,59,42,86,84,84,'scorer'),
      p('Julie Allemand','G','LA',620000,1,'Pass-first organizer who keeps talented rosters from drifting.','Court vision, tempo, international polish','Scoring pressure, durability',false,62,65,86,62,40,64,88,68,'engine'),
      p('Azurá Stevens','F/C','LA',690000,1,'Skilled frontcourt spacer with length and scoring touch.','Shooting size, weakside defense, skill','Physicality, availability',false,72,70,60,68,70,58,76,68,'stretch'),
      p('Kate Martin','G/F','LA',300000,1,'Developmental wing with shooting feel, team-first habits, and coach-trust traits.','Shooting base, IQ, leadership','On-ball creation, athletic separation',false,55,66,55,61,45,58,73,69,'prospect')
    ]),
    team('MIN','Minnesota Lynx','#0c2340','#78be20','contender',[
      p('Napheesa Collier','F','MIN',1330000,3,'MVP-level two-way forward who fits every lineup and punishes every coverage.','Scoring efficiency, defense, versatility','Heavy workload management',true,94,78,79,92,86,80,96,97,'star'),
      p('Courtney Williams','G','MIN',860000,2,'Midrange guard with rebounding and veteran personality.','Pull-up jumper, boards, swagger','Three-point volume, shot selection',true,77,67,73,70,59,70,82,75,'veteran'),
      p('Kayla McBride','G/F','MIN',880000,2,'Professional shooter who spaces the floor and competes defensively.','Movement shooting, experience, spacing','Rim pressure, age curve',true,77,86,65,68,47,61,86,72,'shooter'),
      p('Alanna Smith','F/C','MIN',760000,2,'Modern big who protects the rim and keeps the offense spaced.','Stretch shooting, rim protection, passing','Physical bruisers, rebounding volume',true,72,74,64,82,73,65,83,77,'stretch'),
      p('DiJonai Carrington','G/F','MIN',730000,1,'Aggressive wing defender who injects chaos into games.','Pressure defense, athleticism, rim attacks','Shooting consistency, decision speed',false,68,58,56,84,62,83,72,73,'defense'),
      p('Jessica Shepard','F/C','MIN',500000,1,'Passing frontcourt piece with strong rebounding feel.','Interior passing, boards, screening','Vertical defense, spacing',false,62,41,67,60,76,47,81,61,'connector'),
      p('Diamond Miller','G/F','MIN',520000,2,'Long slashing wing with upside if the jumper settles.','Size, rim pressure, defensive tools','Shooting reliability, injuries',false,68,52,54,68,58,82,62,80,'prospect')
    ]),
    team('NY','New York Liberty','#86cebc','#000000','contender',[
      p('Breanna Stewart','F','NY',1360000,3,'Championship-caliber superstar who scores, defends, and solves lineup problems.','Elite scoring, switch defense, experience','Workload management only',true,95,83,80,91,83,78,96,97,'star'),
      p('Sabrina Ionescu','G','NY',1220000,3,'High-volume creator whose shooting bends every defensive shell.','Pull-up range, passing, rebounding guard','Point-of-attack defense',true,89,92,90,66,58,75,92,93,'engine'),
      p('Jonquel Jones','C','NY',1120000,2,'Former MVP big with rare shooting and rebounding blend.','Stretch big scoring, glass, size','Switch-heavy defensive speed',true,86,75,68,78,88,58,90,87,'stretch'),
      p('Betnijah Laney-Hamilton','G/F','NY',780000,1,'Tough wing who guards up and down the lineup.','Defense, strength, timely scoring','Creation burst after injuries',true,70,67,60,84,58,62,84,68,'defense'),
      p('Leonie Fiebich','F','NY',640000,2,'Oversized wing spacer with elite team context value.','Shooting size, connective passing, defense','Self-created scoring volume',false,68,78,62,75,61,61,80,78,'connector'),
      p('Nyara Sabally','F/C','NY',420000,1,'Mobile reserve big with activity and finishing.','Mobility, finishing, energy','Fouls, health, shooting',false,62,34,46,66,70,66,62,69,'big'),
      p('Marquesha Davis','G/F','NY',360000,1,'Young wing who can defend and attack closeouts.','Athleticism, rim pressure, defensive tools','Shooting, role clarity',false,57,50,45,62,48,73,58,69,'prospect')
    ]),
    team('PHX','Phoenix Mercury','#201747','#e56020','contender',[
      p('Alyssa Thomas','F','PHX',1260000,2,'Point-forward wrecking ball who organizes, rebounds, and defends every possession.','Playmaking, defense, physicality','Shooting range',true,83,28,93,91,88,76,98,90,'engine'),
      p('Satou Sabally','F','PHX',1180000,3,'Big wing scorer with star traits and matchup gravity.','Scoring versatility, size, transition','Availability, shot selection swings',true,89,78,74,75,77,79,83,91,'star'),
      p('Kahleah Copper','G/F','PHX',1100000,2,'Explosive downhill scorer who gives playoff defenses problems.','Rim pressure, transition, shot making','Playmaking reads, defensive energy variance',true,88,74,66,69,59,87,80,84,'scorer'),
      p('Natasha Cloud','G','PHX',780000,1,'Veteran guard who brings defense, voice, and passing.','Leadership, defense, playmaking','Shooting consistency',true,66,60,82,84,48,70,88,68,'veteran'),
      p('Monique Akoa Makani','G','PHX',440000,3,'Quick guard prospect with international creation flashes.','Pace, handle, creativity','Strength, defensive reads',false,60,59,64,55,38,78,61,79,'prospect'),
      p('Megan McConnell','G','PHX',390000,2,'High-IQ guard who pressures full court and keeps the ball moving.','Defense, passing, competitiveness','Scoring ceiling, size',false,55,54,68,73,40,70,75,71,'defense'),
      p('Kalani Brown','C','PHX',430000,1,'Paint scorer with size and soft hands.','Post touch, rebounding, screens','Pace, defensive space',false,64,21,42,55,76,35,69,57,'big')
    ]),
    team('SEA','Seattle Storm','#2c5234','#fee11a','retooling',[
      p('Skylar Diggins','G','SEA',930000,1,'Competitive lead guard who can still bend a defense with pace and craft.','Rim pressure, passing, toughness','Age curve, efficiency swings',true,80,70,82,68,42,79,88,70,'veteran'),
      p('Nneka Ogwumike','F','SEA',1040000,1,'Model veteran forward with elite efficiency and locker-room value.','Efficiency, leadership, defensive positioning','Age curve, high-volume creation',true,84,64,72,80,80,66,96,73,'veteran'),
      p('Gabby Williams','G/F','SEA',810000,2,'Elite wing defender and transition connector.','Defense, passing, athleticism','Shooting gravity, half-court scoring',true,68,54,72,91,64,86,86,76,'defense'),
      p('Dominique Malonga','C','SEA',680000,3,'High-upside center prospect with rare movement and vertical tools.','Size, mobility, potential','Strength, consistency, foul discipline',true,67,32,48,73,78,72,62,90,'prospect'),
      p('Ezi Magbegor','C','SEA',890000,2,'Mobile defensive big who can anchor modern coverages.','Rim protection, mobility, finishing','Offensive creation',true,74,43,58,89,82,73,82,84,'anchor'),
      p('Erica Wheeler','G','SEA',480000,1,'Veteran point guard who can steady second units.','Ball pressure, pace, experience','Size, shooting',false,61,56,72,62,38,76,80,58,'veteran'),
      p('Jordan Horston','G/F','SEA',500000,2,'Long wing with defensive playmaking and developing offensive feel.','Length, transition, defensive events','Shooting, turnovers',false,64,46,56,76,58,82,63,78,'prospect')
    ]),
    team('WAS','Washington Mystics','#e31837','#002b5c','rebuilding',[
      p('Sonia Citron','G/F','WAS',720000,3,'Polished young wing who plays older than her age and fits many lineup types.','Shooting base, defense, decision-making','Elite creation, athletic ceiling',true,72,76,64,76,58,66,81,85,'connector'),
      p('Kiki Iriafen','F','WAS',760000,3,'Pro-ready forward who gives structure to a young roster; already valued like a core starter.','Face-up scoring, glass, physicality','Passing reads under doubles, foul discipline',true,83,64,63,79,84,75,80,90,'forward'),
      p('Brittney Sykes','G','WAS',780000,1,'Relentless defensive guard who creates transition offense out of pressure.','Defense, rim pressure, competitiveness','Shooting consistency, turnovers',true,73,60,66,90,48,84,78,74,'defense'),
      p('Shakira Austin','C','WAS',700000,2,'Mobile big with two-way starter tools if health cooperates.','Mobility, defense, finishing','Availability, foul discipline',true,72,34,50,80,79,72,68,83,'anchor'),
      p('Georgia Amoore','G','WAS',520000,3,'Crafty guard with passing imagination and deep range.','Range, pick-and-roll passing, confidence','Size, defensive targeting',false,67,75,78,55,36,73,74,82,'engine'),
      p('Stefanie Dolson','C','WAS',460000,1,'Stretch veteran big who opens spacing and communicates coverages.','Passing, shooting, experience','Foot speed, rim protection',false,62,71,65,55,66,38,85,53,'stretch'),
      p('Emily Engstler','F','WAS',410000,1,'Activity forward who racks up chaos stats.','Stocks, rebounding, edge','Shooting, offensive discipline',false,59,44,47,73,74,71,59,66,'defense')
    ]),
    team('POR','Portland Fire','#cc4e00','#111111','expansion',[
      p('Kelsey Bone','C','POR',520000,1,'Veteran interior body who helps an expansion team survive physical nights.','Size, rebounding, screens','Spacing, foot speed',false,58,24,40,58,76,35,73,54,'big'),
      p('Grace Berger','G','POR',430000,2,'Composed guard who can keep bench possessions organized.','Midrange touch, poise, passing','Three-point volume, defensive burst',false,60,57,67,58,45,59,77,70,'connector'),
      p('Mikiah Herbert Harrigan','F','POR',410000,1,'Stretch forward with useful shot-blocking flashes.','Length, shooting, weakside blocks','Physicality, consistency',false,60,67,45,65,58,62,59,62,'stretch'),
      p('Aari McDonald','G','POR',510000,1,'Small speed guard who changes tempo and can bother ball handlers.','Speed, pressure defense, downhill attack','Finishing size, jumper streaks',false,66,61,63,70,36,89,67,66,'spark'),
      p('Charisma Osborne','G','POR',440000,2,'Strong guard prospect with two-way role-player pathway.','Strength, defense, straight-line drives','Creation polish, shooting consistency',false,61,60,55,67,45,72,63,74,'prospect'),
      p('Alissa Pili','F','POR',500000,2,'Unique scoring forward with touch and strength.','Scoring touch, strength, mismatch value','Lateral defense, conditioning',false,69,62,50,50,65,49,62,76,'scorer')
    ]),
    team('TOR','Toronto Tempo','#d71920','#111111','expansion',[
      p('Laeticia Amihere','F','TOR',500000,2,'Long forward with defensive upside and Canadian market value.','Length, switchability, transition','Shooting, offensive role',false,59,41,49,73,66,76,61,77,'defense'),
      p('Aaliyah Edwards','F','TOR',680000,3,'Physical forward with high motor and starter development arc.','Rebounding, strength, interior finishing','Spacing, passing speed',true,72,38,54,74,82,73,70,84,'forward'),
      p('Kia Nurse','G/F','TOR',560000,1,'Veteran Canadian wing who brings shooting reputation and leadership.','Shooting, experience, market fit','Health curve, defense vs top wings',false,64,72,55,58,46,58,79,58,'veteran'),
      p('Dyaisha Fair','G','TOR',420000,2,'Undersized shot creator with real scoring nerve.','Shot creation, handle, confidence','Size, finishing efficiency',false,63,67,58,49,34,76,60,72,'spark'),
      p('Queen Egbo','C','TOR',410000,1,'Mobile depth center who can rebound and protect the paint in spurts.','Length, rebounding, shot blocking','Offensive touch, fouls',false,55,21,39,64,72,65,58,61,'big'),
      p('Maddy Westbeld','F','TOR',470000,3,'Skilled forward prospect with stretch potential.','Size shooting, passing feel, fit','Defensive speed, physicality',false,61,66,58,57,60,55,66,78,'prospect')
    ])
  ]
};
function team(id,name,primary,secondary,status,players){return {id,name,primary,secondary,status,players};}
function p(name,pos,team,salary,years,scouting,strengths,weaknesses,protectedPlayer,scoring,shooting,playmaking,defense,rebounding,athleticism,iq,potential,archetype){
  return { id: slug(name+'-'+team), name,pos,team,salary,years,scouting,strengths,weaknesses,protected:protectedPlayer, ratings:{scoring,shooting,playmaking,defense,rebounding,athleticism,iq,potential}, archetype, mood: 55+Math.floor(Math.random()*30) };
}
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
