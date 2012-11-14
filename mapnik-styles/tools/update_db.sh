echo $(date)' importing pistes'>> update_db.log
osm2pgsql --create -m -v -d pistes-mapnik -U mapnik ../Planet/data/planet_pistes.osm --slim -C 2048 -S config/pistes.style
echo $(date)' add columns to speed up rendering'>> update_db.log
./speedup.py
echo $(date)' offset pistes'>> update_db.log
./offset.py
echo $(date)' done'>> update_db.log

