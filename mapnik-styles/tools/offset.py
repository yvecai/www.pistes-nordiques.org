#!/usr/bin/python
"""
osm2pgsql --create -m -v -d pistes-mapnik -U mapnik data/planet_pistes.osm --slim -C 2048 -S config/pistes.style

"""
import psycopg2
import pdb
import time
db='pistes-mapnik'
conn = psycopg2.connect("dbname="+db+" user=mapnik")
cur = conn.cursor()
#cur.execute("select count(*) from planet_osm_line;")
#cur.execute("select osm_id, ST_length(way) from planet_osm_line order by ST_length(way) desc limit 10;;")
IS_OFFSET=1
ITERATION=0
while (IS_OFFSET and ITERATION < 7 ):
    ITERATION+=1
    IS_OFFSET=0
    print "ITERATION: ", ITERATION
    offsets={}
    cur.execute(" \
     select id from planet_osm_line where osm_id < 0\
    order by length DESC;")
    relations=cur.fetchall()
    cur.close()
    conn.close()
    
       #print relations
    for relation in relations:
        offsets[relation[0]]=0 # [offset, direction]
    
    offset_rule={0:-1,
    1:-2,
    2:-3,
    3:-4,
    4:-5,
    5:-6,
    6:-7,
    7:-8}

    for relation in relations:
        
        #pdb.set_trace()
        conn = psycopg2.connect("dbname="+db+" user=mapnik") 
        cur = conn.cursor()
        cur.execute(" \
        SELECT DISTINCT a.id \
        FROM planet_osm_line AS a,planet_osm_line AS b \
        WHERE b.id="+str(relation[0])+" \
            AND ST_length(ST_intersection(a.way, b.way)) > 0 \
            AND ST_intersects(a.way, b.way) \
            AND a.osm_id<0 \
            AND a.id<>"+str(relation[0])+" \
            AND (a.color <> b.color \
            or a.colour <> b.colour\
            or a.colour <> b.color\
            or a.color <> b.colour) ;") # Do not try to offset multilines

        intersects=cur.fetchall()
        #print "relation:", relations[0]
        #print "share way with: ", intersects
        for intersect in intersects:
            
            try:
                if offsets[intersect[0]] in offset_rule: 
                    of=offset_rule[offsets[intersect[0]]]
                else: of=0
                cur.execute("update planet_osm_line set way=ST_OffsetCurve(way,"+str(20*of)+")\
                 where id="+str(intersect[0])+";")
                 
                IS_OFFSET=1
                conn.commit()
                
                offsets[intersect[0]]+=1
                # print "relation %s is offset %s times" %(str(intersect[0]),str(offsets[intersect[0]]))
                
            except psycopg2.DataError as detail:
                # fail if the offset is a multiline string
                offsets[intersect[0]]+=1
                IS_OFFSET=1
                print "relation %s failed to offset" %(str(intersect[0]))
                print detail
                # rollback to reset error
                conn.rollback()
                pass
            except psycopg2.InternalError as detail:
                # fail if the previous cursor.execute() failed
                # Solved with conn.rollback() on a failed cur.execute()
                print "relation %s failed to offset" %(str(intersect[0]))
                print detail
                pass
            except psycopg2.DatabaseError as detail:
                # Sometime we are disconnected
                print "relation %s failed to offset" %(str(intersect[0]))
                print detail
                try:
                    conn = psycopg2.connect("dbname="+db+" user=mapnik")
                    cur = conn.cursor()
                except psycopg2.OperationalError as detail:
                    # Sometime we are disconnected and the database is being restored
                    print "relation %s failed to offset" %(str(intersect[0]))
                    print detail
                    time.sleep(5)
                    conn = psycopg2.connect("dbname="+db+" user=mapnik")
                    cur = conn.cursor()
                
    print "IS_OFFSET", IS_OFFSET
# todo: check why there is empty relations at coord(0,0), make mapnik crash
cur.execute("delete from planet_osm_line where st_isempty(way);")
conn.comit();

cur.close()
conn.close()

#for o in offsets:
    #print o, offsets[o]
    

