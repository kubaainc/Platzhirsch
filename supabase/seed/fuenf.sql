-- Fuenf-Layout als erstes Team (aus der Design-Vorschau). Positionen in Raum-Pixeln, Ursprung links oben, x/y = Mittelpunkt.
do $$ declare tid uuid; rid uuid; begin
  insert into teams (slug, name, allowed_origins) values ('fuenf','fünf',array['https://fuenf.de','https://www.fuenf.de']) returning id into tid;
  insert into rooms (team_id,name,sort,width,height,outdoor) values (tid,'Restaurant',0,1290,1070,false) returning id into rid;
  insert into room_elements (team_id,room_id,kind,path) values (tid,rid,'wall','M10,255 L765,255 L765,15 L1270,15 L1270,620 L1185,620 L1185,1050 L10,1050 Z');
  insert into room_elements (team_id,room_id,kind,x,y,w,h) values (tid,rid,'pillar',583,302,66,88);
  insert into room_elements (team_id,room_id,kind,x,y,w,h) values (tid,rid,'pillar',604,672,108,108);
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T1',4,12,true,true,94,755,124,78,0,false); -- T1
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T2',4,12,true,true,88,508,120,80,0,false); -- T2
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T3',2,6,true,true,57,312,65,60,0,false); -- T3
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T4',3,8,true,true,165,312,110,62,0,false); -- T4
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T5',3,4,true,true,297,310,112,62,0,false); -- T5
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T6/17',3,6,true,true,1164,87,120,62,0,false); -- T6/17
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T7',1,7,true,true,492,307,62,62,0,false); -- T7
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T8',2,2,true,true,458,461,56,58,0,false); -- T8
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T9',2,6,true,true,470,673,100,100,0,true); -- T9
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T10',2,8,true,true,306,959,200,56,0,false); -- T10
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T10.1',2,4,true,true,158,959,60,58,0,false); -- T10.1
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T11',2,4,true,true,303,755,72,72,45,false); -- T11
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T12',2,4,true,true,302,508,72,72,45,false); -- T12
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T13',1,14,true,true,853,263,62,80,0,false); -- T13
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T14',2,14,true,true,852,180,62,80,0,false); -- T14
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T15',2,14,true,true,849,92,62,80,0,false); -- T15
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T23',1,2,true,true,601,572,54,58,0,false); -- T23
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T21',2,6,false,true,891,881,556,80,0,true); -- T21-R
  insert into rooms (team_id,name,sort,width,height,outdoor) values (tid,'Lounge',1,1280,1060,false) returning id into rid;
  insert into room_elements (team_id,room_id,kind,path) values (tid,rid,'wall','M20,250 L530,250 L530,275 L765,275 L765,20 L1250,20 L1250,600 L1165,600 L1165,1015 L20,1015 Z');
  insert into room_elements (team_id,room_id,kind,x,y,w,h) values (tid,rid,'pillar',580,298,66,90);
  insert into room_elements (team_id,room_id,kind,x,y,w,h) values (tid,rid,'pillar',600,654,106,108);
  insert into room_elements (team_id,room_id,kind,x,y,w,h) values (tid,rid,'pillar',576,1010,58,48);
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T18',2,4,true,true,1161,258,70,75,0,false); -- T18
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T19',2,4,true,true,1166,495,66,66,45,false); -- T19
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T20',2,4,true,true,978,426,66,66,45,false); -- T20
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T21',2,6,true,true,880,860,556,80,0,true); -- T21
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T22',2,3,true,true,699,678,56,56,0,true); -- T22
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T24',2,2,true,true,877,619,62,62,0,true); -- T24
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T25',2,2,true,true,1063,652,60,60,0,true); -- T25
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T26',2,2,true,true,798,459,60,60,0,true); -- T26
  insert into rooms (team_id,name,sort,width,height,outdoor) values (tid,'Biergarten',2,1420,770,true) returning id into rid;
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T30',2,2,true,true,242,700,72,72,0,true); -- T30
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T31',2,4,false,true,85,635,115,115,0,true); -- T31
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T32',2,2,true,true,153,467,76,70,-15,false); -- T32
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T33',4,6,true,true,223,345,80,80,35,false); -- T33
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T34',2,6,false,true,353,211,76,76,22,false); -- T34
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T34.1',2,6,false,true,385,293,76,76,22,false); -- T34.1
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T35',4,6,true,true,545,192,82,125,-5,false); -- T35
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T36',4,6,true,true,710,155,82,130,0,false); -- T36
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T37',3,6,true,true,933,143,80,125,0,false); -- T37
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T38',4,6,true,true,1116,143,80,125,0,false); -- T38
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T39',2,7,false,true,1285,88,78,98,0,false); -- T39
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T39.1',2,7,false,true,1287,192,78,98,0,false); -- T39.1
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T40',2,2,true,true,262,582,70,70,20,false); -- T40
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T41',2,4,true,true,450,640,106,106,0,true); -- T41
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T42',2,4,true,true,408,481,98,98,0,true); -- T42
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T43',2,2,true,true,557,371,80,80,0,true); -- T43
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T44',2,4,true,true,680,508,102,102,0,true); -- T44
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T45',1,2,true,true,780,342,72,72,45,false); -- T45
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T46',4,6,true,true,900,515,80,125,0,false); -- T46
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T47',4,6,true,true,1049,510,80,125,0,false); -- T47
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T48',4,6,true,true,1202,507,80,125,0,false); -- T48
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T49',2,6,false,true,1346,437,80,120,0,false); -- T49
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T49.1',2,6,false,true,1353,568,80,120,0,false); -- T49.1
  insert into tables (team_id,room_id,label,min_seats,max_seats,online_bookable,placed,x,y,w,h,rot,round) values (tid,rid,'T50',2,4,false,true,1137,310,78,78,0,true); -- T50
end $$;
