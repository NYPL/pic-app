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
    # if r
    #   # puts r
    #   # replace the addresses with the inner_hits
    #   @results = {
    #     hits: {
    #       total: r["hits"]["total"],
    #       hits: []
    #     }
    #   }
    #   # puts "\n\n\n\n\n\n\n\n\n\n\n\n"
    #   # puts r
    #   r["hits"]["hits"].each do |hit|
    #     tmp = {
    #       _source: hit["_source"]
    #     }
    #     # puts "\n\n\n\n\n\n\n\n\n\n\n\n"
    #     # puts hit
    #   #   # puts "\n\n\n\n\n\n\n\n\n\n\n\n"
    #     if (hit["inner_hits"] != nil)
    #       tmp[:_source]["address"] = hit["inner_hits"]["address"]["hits"]["hits"].map { |a| a["_source"]}
    #     end
    #     @results[:hits][:hits].push(tmp)
    #   end
    #   # @results = r
    # end
    render :json => @results
  end

  def export
    client = Elasticsearch::Client.new host: connection_string
    type = "json"
    if params[:type] != nil
      type = params[:type]
    end
    begin
      q = JSON.parse(params[:q])
      filter_path = params[:filter_path]
      from = 0
      size = 100
      source = params[:source]
      exclude = params[:source_exclude]
      sort = "AlphaSort.raw:asc"
      r = client.search index: 'pic', type: "constituent", body: q, size: size, from: from, sort: sort, _source: source, _source_exclude: exclude, filter_path: filter_path
    rescue
      @results = nil
    end
    if r && r["hits"]["total"] > 0
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
            address = address_raw["_source"]
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
    begin
      results = client.search index: 'pic', q: "constituent.ConstituentID:#{params[:id]}"
    rescue
      @constituent = nil
    end
    if results && results["hits"]["total"] > 0
      @constituent = results["hits"]["hits"][0]["_source"]
    end
    respond_with @constituent do |f|
      f.html {render json: @constituent}
      f.json
    end
  end

end
