import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {once} from 'node:events';
import {HiveClient} from '@red-cup-engineering/hive-blockchain-client-service';
import {PrivateKey} from '@red-cup-engineering/hive-blockchain-client-service/keys.mjs';
import {titlePermlink} from '@red-cup-engineering/hive-blockchain-client-service/ops.mjs';
import {marketBuyWalk} from '@red-cup-engineering/exact-order-book-service';
import {gradedOfDecimal,gradedToExactString} from '@red-cup-engineering/exact-number-data-service/graded';
const q=(s,g)=>gradedOfDecimal(s,g);
const book={bids:[],asks:[{price:q('2','HBD'),quantity:q('9007199254740993','HIVE')}]};
const walk=marketBuyWalk(book,q('9007199254740993','HIVE'));
assert.equal(gradedToExactString(walk.cost),'18014398509481986/1 HBD');
assert.throws(()=>marketBuyWalk(book,q('1','HBD')),/commodity/);
const key=Buffer.alloc(32);key[31]=1;const p=new PrivateKey(key);assert.deepEqual(PrivateKey.from(p.toString()).secret,key);assert.equal(titlePermlink('Héllo World'),'hello-world');
const server=createServer(async(req,res)=>{let text='';for await(const b of req)text+=b;const c=JSON.parse(text);res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:c.id,result:[{name:'fixture',balance:'9007199254740993.000 HIVE'}]}));});
server.listen(0,'localhost');await once(server,'listening');
try{const client=new HiveClient({nodes:['http://localhost:'+server.address().port]});assert.equal((await client.getAccount('fixture')).balance,'9007199254740993.000 HIVE');console.log('Hive consumer retained HTTP account retrieval, exact commodity-aware book walk, key roundtrip and permlink generation.');}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
