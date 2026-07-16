<?php
declare(strict_types=1);
require __DIR__ . '/api.php';

function check(bool $cond, string $msg): void {
  if (!$cond) { fwrite(STDERR, "FAIL: $msg\n"); exit(1); }
  echo "ok: $msg\n";
}

// yt_id extrai videoId de formatos variados
check(yt_id('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'yt watch url');
check(yt_id('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'yt short url');
check(yt_id('nao-e-url') === null, 'yt invalido vira null');

$lib = ['items' => []];

// add_link youtube
$lib = add_link($lib, ['category'=>'track','source'=>'youtube','title'=>'Batalha','ref'=>'https://youtu.be/dQw4w9WgXcQ']);
check(count($lib['items']) === 1, 'add_link adiciona item');
check($lib['items'][0]['ref'] === 'dQw4w9WgXcQ', 'add_link guarda videoId');
check($lib['items'][0]['loop'] === false, 'track nao faz loop');

// add_link ambient => loop true
$lib = add_link($lib, ['category'=>'ambient','source'=>'mp3url','title'=>'Chuva','ref'=>'https://x/y.mp3']);
check($lib['items'][1]['loop'] === true, 'ambient faz loop por padrao');

// add_link rejeita categoria invalida
try { add_link($lib, ['category'=>'x','source'=>'mp3url','title'=>'t','ref'=>'https://a.mp3']); check(false,'deveria lancar'); }
catch (ApiError $e) { check(true, 'categoria invalida rejeitada'); }

// add_link rejeita mp3url sem http
try { add_link($lib, ['category'=>'sfx','source'=>'mp3url','title'=>'t','ref'=>'ftp://a.mp3']); check(false,'deveria lancar'); }
catch (ApiError $e) { check(true, 'mp3url nao-http rejeitada'); }

// validate_upload rejeita nao-mp3
try { validate_upload(['error'=>0,'size'=>10,'tmp_name'=>__FILE__], 30*1024*1024); check(false,'deveria lancar'); }
catch (ApiError $e) { check(true, 'nao-mp3 rejeitado'); }

// record_file adiciona item mp3file com filename
$lib = record_file($lib, 'sfx', 'Porta', 'abc123.mp3');
$last = end($lib['items']);
check($last['source']==='mp3file' && $last['ref']==='abc123.mp3', 'record_file guarda filename');

// delete_item remove por id
$id = $lib['items'][0]['id'];
$before = count($lib['items']);
$lib = delete_item($lib, $id, sys_get_temp_dir());
check(count($lib['items']) === $before-1, 'delete_item remove');

// save/load round-trip
$tmp = tempnam(sys_get_temp_dir(),'lib');
save($tmp, $lib);
check(load($tmp) == $lib, 'save/load round-trip');
unlink($tmp);

echo "\nTODOS OS TESTES PASSARAM\n";
