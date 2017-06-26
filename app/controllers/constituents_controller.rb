class ConstituentsController < ApplicationController

  respond_to :html, :json
  skip_before_filter :verify_authenticity_token, only: [:search]


  def index
  end

  def map
    require 'open-uri'
    @admin = params[:admin] != nil
    @min_year = open("#{ENV['CLOUDFRONT_URL']}csv/minyear.txt"){|f| f.read}
    @min_year = @min_year.to_i
  end

  def a_z
    client = Elasticsearch::Client.new host: connection_string
    # puts "\n\n\n\n\n"
    # puts params
    # puts "\n\n\n\n\n"
    @total_pages = 1
    @page = 1
    @total = 0
    begin
      p = params
      @letter = p[:letter].downcase || "a"
      @page = p[:page] == nil ? 1 : p[:page].to_i
      q = {
        "query": {
          "span_first": {
            "match": {
              "span_multi": {
                "match": {
                  "prefix": {
                    "nameSort": {
                      "value": "#{@letter}"
                    }
                  }
                }
              }
            },
            "end": 1
          }
        }
      }
      puts "#{@page} ---- #{p[:page]}"
      size = 1000
      from = (@page - 1) * size
      source = "DisplayName,AlphaSort,nameSort,ConstituentID"
      type = "constituent"
      sort = "AlphaSort.raw:asc"
      r = client.search index: 'pic', type: type, body: q, size: size, from: from, sort: sort, _source: source
      @total = r["hits"]["total"].to_i
      @total_pages = (@total.to_f / size.to_f).ceil
    rescue
    #   @results = nil
    end
    # puts "QUERY:"
    # puts q
    @results = r
    respond_with @results do |f|
      f.html # {render json: @constituent}
      f.json {render json: @results}
    end
  end

  def search
    client = Elasticsearch::Client.new host: connection_string
    # puts "\n\n\n\n\n"
    # puts params
    # puts "\n\n\n\n\n"
    begin
      p = params
      q = p[:q]
      filter_path = p[:filter_path]
      from = p[:from].to_i
      size = p[:size].to_i
      source = p[:source]
      type = p[:docType]
      exclude = p[:source_exclude]
      sort = p[:sort]
      r = client.search index: 'pic', type: type, body: q, size: size, from: from, sort: sort, _source: source, _source_exclude: exclude, filter_path: filter_path
    rescue
      @results = nil
    end
    # puts "QUERY:"
    # puts q
    @results = r
    render :json => @results
  end

  def export
    client = Elasticsearch::Client.new host: connection_string
    max_address_size = 10000 # how many child addresses for a constituent
    max_export_size = 100 # how many results in an export
    type = "json"
    if params[:type] != nil
      type = params[:type]
    end
    if params[:ConstituentID] != nil
        # looking for a photographer
        begin
            id = params[:ConstituentID]
            qc = {query:{"bool":{must:[{query_string:{query:"((ConstituentID:#{id}))"}}]}}}
            r = client.search index: 'pic', type: "constituent", body: qc, size: 1
            qa = {query:{"bool":{must:[{has_parent:{type:"constituent",query:{bool:{must:[{query_string:{query:"(ConstituentID:#{id})"}}]}}}}]}}}
            ra = client.search index: 'pic', type: "address", body: qa, size: max_address_size
            temp = r["hits"]["hits"]
            temp[0]["address"] = ra["hits"]["hits"].map {|a| a["_source"]}
        rescue
          @results = nil
        end
    else
        # looking for a regular export
        begin
            q = JSON.parse(params[:q])
            filter_path = params[:filter_path]
            from = 0
            source = params[:source]
            exclude = params[:source_exclude]
            sort = "AlphaSort.raw:asc"
            r = client.search index: 'pic', type: "constituent", body: q, size: max_export_size, from: from, sort: sort, _source: source, _source_exclude: exclude, filter_path: filter_path
        rescue
          @results = nil
        end
        # puts "type: #{params} |#{params[:type]==nil}|"
        temp = r["hits"]["hits"]
        temp.each_with_index do |hit, index|
            q_address = {"query" => {"bool" => {"must" => [{"query_string" => {"query" => "ConstituentID:#{hit["_source"]["ConstituentID"]}"}}]}}}
            address_query = client.search index: 'pic', type: 'address', body: q_address, size: 5000
            if address_query["hits"]["total"] > 0
                # puts address_query
                temp[index]["address"] = address_query["hits"]["hits"]
            end
        end
    end
    if r && r["hits"]["total"] > 0
      if type == "json"
        @results = temp
      elsif type == "geojson"
        @results = {
          :type => "FeatureCollection", :features => []
        }
        temp.each do |hit|
          r = {}
          r[:type] = "Feature"
          r[:properties] = hit
          r[:geometry] = { :type => "MultiPoint", :coordinates => [] }
          next if hit["address"] == nil
          hit["address"].each do |address_raw|
            address = address_raw["_source"] || address_raw
            r[:geometry][:coordinates].push([address["Location"]["lon"], address["Location"]["lat"]]) if address["Location"] != nil
          end
          @results[:features].push(r)
        end
      end
    end
    render :json => @results
  end

  def show
    client = Elasticsearch::Client.new host: connection_string
    max_address_size = 10000 # how many child addresses for a constituent
    begin
      # results = client.search index: 'pic', q: "constituent.ConstituentID:#{params[:id]}"
      id = params[:id]
      qc = {query:{"bool":{must:[{query_string:{query:"((ConstituentID:#{id}))"}}]}}}
      r = client.search index: 'pic', type: "constituent", body: qc, size: 1
      qa = {query:{"bool":{must:[{has_parent:{type:"constituent",query:{bool:{must:[{query_string:{query:"(ConstituentID:#{id})"}}]}}}}]}}}
      ra = client.search index: 'pic', type: "address", body: qa, size: max_address_size
      @constituent = r["hits"]["hits"][0]["_source"]
      @constituent["address"] = ra["hits"]["hits"].map {|a| a["_source"]}
    rescue
      @constituent = nil
    end
    begin
      if @constituent["biography"] && @constituent["biography"].count > 0
        @constituent["biography"].each do |biography|
          if biography["TermID"] == "2028247" # wikidata
            wikidata_url = biography["URL"]
            wikidata_id = wikidata_url.sub "https://www.wikidata.org/wiki/", ""
            source_url = "https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=#{wikidata_id}&property=P18&format=json"
            image_json = JSON.load(open(source_url))
            image_file = image_json["claims"]["P18"][0]["mainsnak"]["datavalue"]["value"].gsub " ", "_"
            image_md5 = Digest::MD5.hexdigest image_file
            image_url = "https://upload.wikimedia.org/wikipedia/commons/#{image_md5[0]}/#{image_md5[0..1]}/#{image_file}"
            @constituent["image_url"] = image_url
            break
          end
        end
      end
    rescue
      puts "no image"
    end
    respond_with @constituent do |f|
      f.html # {render json: @constituent}
      f.json {render json: @constituent}
    end
  end

end
