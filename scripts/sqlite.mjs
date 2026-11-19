export function bind(sqlite){
 const statement=(sql,values=[])=>({
  bind(...args){return statement(sql,args);},
  async first(){return sqlite.prepare(sql).get(...values)??null;},
  async all(){return {results:sqlite.prepare(sql).all(...values)};},
  async run(){return sqlite.prepare(sql).run(...values);},
  result(){return sqlite.prepare(sql).run(...values);}
 });
 return {
  prepare:statement,
  async batch(statements){
   sqlite.exec('BEGIN');
   try{
    const result=statements.map(query=>query.result());
    sqlite.exec('COMMIT');return result;
   }catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
 };
}
