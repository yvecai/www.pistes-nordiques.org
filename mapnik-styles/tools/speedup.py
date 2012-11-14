#!/usr/bin/python
"""
osm2pgsql --create -m -v -d pistes-mapnik -U mapnik data/planet_pistes.osm --slim -C 2048 -S config/pistes.style

"""
import psycopg2
import pdb
import time
import os
db='pistes-mapnik'
conn = psycopg2.connect("dbname="+db+" user=mapnik")
cur = conn.cursor()
# Add a unique id
os.system('echo "ALTER TABLE planet_osm_line ADD COLUMN id serial unique;"| psql -d pistes-mapnik')
#cur.execute("ALTER TABLE planet_osm_line ADD COLUMN id serial unique;")
#conn.commit()
#Add a length column to render small relations above:
#cur.execute("ALTER TABLE planet_osm_line DROP COLUMN length;")
cur.execute("ALTER TABLE planet_osm_line ADD COLUMN length double precision;")
cur.execute("UPDATE planet_osm_line SET length = ST_Length(way);")
conn.commit()
#Add a in_rel column to render ways that are not in a relation:
#cur.execute("ALTER TABLE planet_osm_line DROP COLUMN in_rel;")
cur.execute("ALTER TABLE planet_osm_line ADD COLUMN in_rel integer[];")
cur.execute(" \
     select osm_id from planet_osm_line where osm_id < 0\
    order by length DESC;")
relations=cur.fetchall()
print "relations", relations
rels={}
progress=len(relations)
for r in relations:
    cur.execute("select parts from planet_osm_rels where id ="+str(-r[0])+";")
    rels[r[0]]=cur.fetchall()
    for w in rels[r[0]][0][0]:
        cur.execute("UPDATE planet_osm_line SET in_rel = planet_osm_line.in_rel || ("+str(r[0])+") where osm_id="+str(w)+";")
    progress -= 1
    print progress
conn.commit()
cur.close()
conn.close()
# split relations in single linestrings


